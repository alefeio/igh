/**
 * Leitura de anexos de nota/conta para pré-preenchimento do formulário financeiro.
 *
 * Pipeline: QR NFC-e → texto PDF → Vision (OpenAI) em imagens se OPENAI_API_KEY existir.
 * Nunca persiste lançamento sozinho — só devolve sugestões para o usuário revisar.
 *
 * Env opcional:
 * - OPENAI_API_KEY — leitura por visão em fotos
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
  guessKnownBillCategory,
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

function looksLikePdf(buffer: Buffer) {
  if (buffer.byteLength < 5) return false;
  return buffer.subarray(0, 5).toString("utf8") === "%PDF-";
}

function guessMime(fileName: string | undefined, contentType: string | null, buffer: Buffer): string {
  if (looksLikePdf(buffer) || fileName?.toLowerCase().endsWith(".pdf")) return "application/pdf";
  const ct = (contentType || "").split(";")[0].trim().toLowerCase();
  if (ct && ct !== "application/octet-stream") return ct;
  const name = (fileName || "").toLowerCase();
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

async function tryExtractPdfText(buffer: Buffer): Promise<{ text: string; error?: string }> {
  if (!looksLikePdf(buffer)) {
    return { text: "", error: "Arquivo baixado não parece um PDF válido." };
  }

  try {
    // Import order matters: worker/canvas polyfills DOMMatrix before pdfjs loads.
    const { CanvasFactory } = await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");

    // Cópia independente: alguns loaders transferem o ArrayBuffer ao worker.
    const data = Uint8Array.from(buffer);
    const parser = new PDFParse({ data, CanvasFactory });
    try {
      const result = await parser.getText();
      const text = (result.text || "").replace(/\u0000/g, "").trim();
      return { text };
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    console.error("[financeiro-invoice-read] pdf-parse failed:", msg);
    return { text: "", error: `Falha ao extrair texto do PDF (${msg.slice(0, 120)}).` };
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
          "Você extrai dados de notas fiscais e contas de consumo brasileiras (água, luz, NF-e, NFC-e, NFS-e, recibos). Responda só JSON com chaves opcionais: amount (string brasileira 1.234,56 sem R$), supplier, description, invoiceNumber, entryDate (YYYY-MM-DD, vencimento), categoryName (Água, Energia, Gás, Internet, Telefone, IPTU, Condomínio ou Aluguel quando for conta de consumo). Prefira o valor TOTAL A PAGAR / valor da fatura. Não invente valores; omita o que não estiver legível.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extraia valor total, fornecedor/concessionária, descrição curta, número da fatura/nota e data de vencimento ou emissão.",
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
    if (typeof parsed.categoryName === "string" && parsed.categoryName.trim()) {
      suggestion.categoryName = parsed.categoryName.trim().slice(0, 40);
    } else {
      const guessed = guessKnownBillCategory(
        [suggestion.supplier, suggestion.description].filter(Boolean).join(" "),
      );
      if (guessed) suggestion.categoryName = guessed.name;
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
    headers: { Accept: "application/pdf,image/*,*/*" },
    cache: "no-store",
    redirect: "follow",
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

  const mime = guessMime(opts.attachmentFileName ?? undefined, res.headers.get("content-type"), buffer);
  let suggestion: InvoiceSuggestion = {};
  let source: InvoiceReadResult["source"] = "partial";

  const isPdf = mime === "application/pdf";
  const isImage = mime.startsWith("image/");

  if (isImage) {
    const fromQr = await tryReadQrFromImage(buffer, mime);
    if (fromQr && suggestionFilledCount(fromQr) > 0) {
      suggestion = mergeSuggestion(suggestion, fromQr);
      source = "qr";
    }
  }

  if (isPdf) {
    const extracted = await tryExtractPdfText(buffer);
    if (extracted.text.trim()) {
      suggestion = mergeSuggestion(suggestion, extractFieldsFromText(extracted.text));
      if (suggestionFilledCount(suggestion) > 0) {
        source = source === "qr" ? "partial" : "pdf";
      } else {
        warnings.push(
          "Texto do PDF lido, mas não foi possível identificar valor/fornecedor automaticamente. Revise e preencha.",
        );
      }
    } else {
      warnings.push(extracted.error || "PDF sem texto embutido legível.");
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
    } else if (isPdf && suggestionFilledCount(suggestion) === 0) {
      warnings.push(
        "Se o PDF for só imagem (escaneado), anexe um JPG/PNG da conta ou configure OPENAI_API_KEY para leitura por visão.",
      );
    } else if (!isImage && !isPdf) {
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
