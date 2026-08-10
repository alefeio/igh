/**
 * Leitura de anexos de nota para pré-preenchimento do formulário financeiro.
 *
 * Pipeline: QR NFC-e → texto PDF → Vision (OpenAI) se OPENAI_API_KEY estiver definida.
 * Nunca persiste lançamento sozinho — só devolve sugestões para o usuário revisar.
 *
 * Env opcional:
 * - OPENAI_API_KEY — habilita leitura por visão em fotos
 * - OPENAI_BASE_URL — default https://api.openai.com/v1
 * - OPENAI_VISION_MODEL — default gpt-4o-mini
 */
import "server-only";

import jsQR from "jsqr";
import { decode as decodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";

import {
  extractFieldsFromText,
  formatAmountFromNumber,
  isCompleteEnough,
  mergeSuggestion,
  parseQrPayload,
  suggestionFilledCount,
  type InvoiceSuggestion,
} from "@/lib/financeiro-invoice-parse";

export type { InvoiceSuggestion };
export { extractFieldsFromText } from "@/lib/financeiro-invoice-parse";

export type InvoiceReadResult = {
  suggestion: InvoiceSuggestion;
  source: "qr" | "pdf" | "vision" | "partial";
  warnings: string[];
};

function isHttpsUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function guessMime(fileName: string | undefined, contentType: string | null): string {
  const ct = (contentType || "").split(";")[0].trim().toLowerCase();
  if (ct && ct !== "application/octet-stream") return ct;
  const name = (fileName || "").toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return ct || "application/octet-stream";
}

async function decodeImageRgba(
  buffer: Buffer,
  mime: string,
): Promise<{ data: Uint8ClampedArray; width: number; height: number } | null> {
  try {
    if (mime === "image/png" || mime === "image/x-png") {
      const png = PNG.sync.read(buffer);
      return {
        data: new Uint8ClampedArray(png.data),
        width: png.width,
        height: png.height,
      };
    }
    if (mime === "image/jpeg" || mime === "image/jpg") {
      const decoded = decodeJpeg(buffer, { useTArray: true });
      return {
        data: new Uint8ClampedArray(decoded.data),
        width: decoded.width,
        height: decoded.height,
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function tryReadQrFromImage(buffer: Buffer, mime: string): Promise<InvoiceSuggestion | null> {
  const rgba = await decodeImageRgba(buffer, mime);
  if (!rgba) return null;
  const code = jsQR(rgba.data, rgba.width, rgba.height, { inversionAttempts: "attemptBoth" });
  if (!code?.data) return null;
  return parseQrPayload(code.data);
}

async function tryExtractPdfText(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text || "";
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  } catch {
    return "";
  }
}

async function tryVisionSuggestion(
  buffer: Buffer,
  mime: string,
): Promise<{ suggestion: InvoiceSuggestion; warning?: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      suggestion: {},
      warning:
        "Leitura por imagem avançada indisponível (defina OPENAI_API_KEY). Preencha os campos manualmente.",
    };
  }

  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
  const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;

  const body = {
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Você extrai dados de notas fiscais brasileiras (NF-e, NFC-e, NFS-e, recibos). Responda só JSON com chaves opcionais: amount (string no formato brasileiro 1.234,56 sem R$), supplier, description, invoiceNumber, entryDate (YYYY-MM-DD). Não invente valores; omita o que não estiver legível.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extraia valor, fornecedor/estabelecimento, descrição curta, número da nota e data de emissão.",
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  };

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        suggestion: {},
        warning: `Falha na leitura por visão (${res.status}). ${errText.slice(0, 120)}`,
      };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const suggestion: InvoiceSuggestion = {};
    if (typeof parsed.amount === "string" || typeof parsed.amount === "number") {
      const raw = String(parsed.amount);
      suggestion.amount = raw.includes(",")
        ? raw.replace(/[^\d.,]/g, "")
        : formatAmountFromNumber(Number(raw.replace(",", ".")));
    }
    if (typeof parsed.supplier === "string" && parsed.supplier.trim()) {
      suggestion.supplier = parsed.supplier.trim().slice(0, 120);
    }
    if (typeof parsed.description === "string" && parsed.description.trim()) {
      suggestion.description = parsed.description.trim().slice(0, 200);
    }
    if (typeof parsed.invoiceNumber === "string" || typeof parsed.invoiceNumber === "number") {
      suggestion.invoiceNumber = String(parsed.invoiceNumber).trim().slice(0, 40);
    }
    if (typeof parsed.entryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.entryDate)) {
      suggestion.entryDate = parsed.entryDate;
    }
    return { suggestion };
  } catch (e) {
    return {
      suggestion: {},
      warning: e instanceof Error ? e.message : "Falha ao interpretar a nota por visão.",
    };
  }
}

export async function readInvoiceAttachment(opts: {
  attachmentUrl: string;
  attachmentFileName?: string | null;
}): Promise<InvoiceReadResult> {
  const warnings: string[] = [];
  if (!isHttpsUrl(opts.attachmentUrl)) {
    return {
      suggestion: {},
      source: "partial",
      warnings: ["URL do anexo inválida (precisa ser HTTPS)."],
    };
  }

  const res = await fetch(opts.attachmentUrl, {
    headers: { Accept: "image/*,application/pdf,*/*" },
    cache: "no-store",
  });
  if (!res.ok) {
    return {
      suggestion: {},
      source: "partial",
      warnings: [`Não foi possível baixar o anexo (${res.status}).`],
    };
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength === 0) {
    return { suggestion: {}, source: "partial", warnings: ["Anexo vazio."] };
  }
  if (buffer.byteLength > 12 * 1024 * 1024) {
    return { suggestion: {}, source: "partial", warnings: ["Anexo muito grande para leitura automática."] };
  }

  const mime = guessMime(opts.attachmentFileName ?? undefined, res.headers.get("content-type"));
  let suggestion: InvoiceSuggestion = {};
  let source: InvoiceReadResult["source"] = "partial";

  const isPdf = mime === "application/pdf" || opts.attachmentFileName?.toLowerCase().endsWith(".pdf");
  const isImage = mime.startsWith("image/");

  if (isImage) {
    const fromQr = await tryReadQrFromImage(buffer, mime);
    if (fromQr && suggestionFilledCount(fromQr) > 0) {
      suggestion = mergeSuggestion(suggestion, fromQr);
      source = "qr";
    }
  }

  if (isPdf) {
    const text = await tryExtractPdfText(buffer);
    if (text.trim()) {
      suggestion = mergeSuggestion(suggestion, extractFieldsFromText(text));
      if (suggestionFilledCount(suggestion) > 0 && source !== "qr") source = "pdf";
      else if (suggestionFilledCount(suggestion) > 0) source = "partial";
    } else {
      warnings.push("PDF sem texto embutido legível.");
    }
  }

  if (!isCompleteEnough(suggestion)) {
    if (isImage) {
      const vision = await tryVisionSuggestion(buffer, mime);
      if (vision) {
        if (vision.warning) warnings.push(vision.warning);
        if (suggestionFilledCount(vision.suggestion) > 0) {
          suggestion = mergeSuggestion(suggestion, vision.suggestion);
          source = source === "qr" || source === "pdf" ? "partial" : "vision";
        }
      }
    } else if (isPdf) {
      warnings.push(
        process.env.OPENAI_API_KEY
          ? "PDF sem texto suficiente: envie uma imagem da nota para leitura por visão."
          : "Não foi possível ler o PDF automaticamente. Anexe uma imagem da nota ou configure OPENAI_API_KEY.",
      );
    } else {
      warnings.push("Formato de anexo não suportado para leitura automática.");
    }
  }

  if (suggestionFilledCount(suggestion) === 0) {
    warnings.push("Nenhum dado extraído. Preencha o formulário manualmente.");
    source = "partial";
  } else if (!isCompleteEnough(suggestion)) {
    source = "partial";
  }

  return { suggestion, source, warnings };
}
