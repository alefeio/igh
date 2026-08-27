/**
 * Leitura de PDF/imagem de termo de doação para pré-preenchimento do formulário.
 *
 * Pipeline:
 * 1) texto PDF (pdf-parse)
 * 2) se insuficiente: renderiza páginas → OCR local (tesseract.js, pt)
 * 3) se ainda insuficiente e OPENAI_API_KEY: Vision nas páginas/imagem
 * Não persiste doação — só devolve sugestões para revisão.
 */
import "server-only";

import {
  detectDonationTermTemplateKind,
  donationTermSuggestionFilledCount,
  donatariaNameHintFromFileName,
  extractDonationTermFromText,
  isDonationTermSuggestionUseful,
  suggestDonationTermTemplateId,
  type DonationTermSuggestion,
} from "@/lib/donation-term-parse";

export type { DonationTermSuggestion };

export type DonationTermReadResult = {
  suggestion: DonationTermSuggestion;
  source: "pdf" | "ocr" | "vision" | "partial";
  warnings: string[];
  matchedDonorInstitutionId: string | null;
  matchedDonatariaId: string | null;
  matchedTemplateId: string | null;
  donatariaCreateCandidate: {
    name: string;
    document: string | null;
    email: string | null;
    phone: string | null;
    contactName: string | null;
    street: string | null;
    city: string | null;
    state: string | null;
    cep: string | null;
    zone: "URBANA" | "RURAL";
  } | null;
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

function onlyDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

async function tryExtractPdfText(buffer: Buffer): Promise<{ text: string; error?: string }> {
  if (!looksLikePdf(buffer)) {
    return { text: "", error: "Arquivo baixado não parece um PDF válido." };
  }
  try {
    const { CanvasFactory } = await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");
    const data = Uint8Array.from(buffer);
    const parser = new PDFParse({ data, CanvasFactory });
    try {
      const result = await parser.getText();
      const text = (result.text || "").replace(/\u0000/g, "").trim();
      // pdf-parse em escaneados devolve só "-- 1 of N --"
      const meaningful = text
        .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      return { text: meaningful.length >= 40 ? text : meaningful };
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    console.error("[donation-term-read] pdf-parse failed:", msg);
    return { text: "", error: `Falha ao extrair texto do PDF (${msg.slice(0, 120)}).` };
  }
}

type PagePng = { buffer: Buffer; pageNumber: number };

const OCR_TIMEOUT_MS = 90_000;
const DOWNLOAD_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} excedeu ${Math.round(ms / 1000)}s`)), ms);
    }),
  ]);
}

/** Renderiza até N primeiras páginas do PDF para OCR. */
async function renderPdfPagesToPng(buffer: Buffer, maxPages = 2): Promise<PagePng[]> {
  const { CanvasFactory } = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: Uint8Array.from(buffer), CanvasFactory });
  try {
    const shot = await parser.getScreenshot({
      first: maxPages,
      scale: 1.5,
      imageBuffer: true,
      imageDataUrl: false,
    });
    const out: PagePng[] = [];
    for (const page of shot.pages ?? []) {
      if (!page?.data) continue;
      out.push({
        buffer: Buffer.from(page.data),
        pageNumber: page.pageNumber ?? out.length + 1,
      });
    }
    return out;
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function ocrPdfPages(pages: PagePng[]): Promise<string> {
  if (pages.length === 0) return "";
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por");
  try {
    const parts: string[] = [];
    for (const page of pages) {
      const result = await worker.recognize(page.buffer);
      const t = (result.data.text || "").trim();
      if (t) parts.push(t);
    }
    return parts.join("\n\n");
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

async function ocrImageBuffer(png: Buffer): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por");
  try {
    const result = await worker.recognize(png);
    return (result.data.text || "").trim();
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

async function tryOcrFromPdfOrImage(
  buffer: Buffer,
  mime: string,
): Promise<{ text: string; warning?: string }> {
  try {
    return await withTimeout(
      (async () => {
        if (mime === "application/pdf") {
          // Pág. 1: doadora/donatária/kits; pág. 2: data por extenso (IGH).
          const pages = await renderPdfPagesToPng(buffer, 2);
          if (pages.length === 0) {
            return { text: "", warning: "Não foi possível renderizar páginas do PDF para OCR." };
          }
          const text = await ocrPdfPages(pages);
          return { text };
        }
        if (mime.startsWith("image/")) {
          const text = await ocrImageBuffer(buffer);
          return { text };
        }
        return { text: "", warning: "Formato sem suporte a OCR local." };
      })(),
      OCR_TIMEOUT_MS,
      "OCR",
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    console.error("[donation-term-read] OCR failed:", msg);
    return {
      text: "",
      warning: `OCR local indisponível (${msg.slice(0, 120)}). Preencha os campos manualmente.`,
    };
  }
}

async function tryVisionSuggestion(
  buffer: Buffer,
  mime: string,
): Promise<{ suggestion: DonationTermSuggestion; warning?: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
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
          "Você extrai dados de TERMOS DE DOAÇÃO brasileiros (IGH/INAC/Computadores para Inclusão). Responda só JSON com chaves opcionais: donorName, donorDocument (CNPJ), donorCity, donorState, donorCep, donorAddress, donorPhone, donorEmail, donorRepresentativeName, donorRepresentativeRole, donorRepresentativeCpf, donatariaName, donatariaDocument (CNPJ), donatariaContactName, donatariaPhone, donatariaEmail, donatariaStreet, donatariaCity, donatariaState, donatariaCep, donatariaZone (URBANA|RURAL), donatedAt (YYYY-MM-DD), placeDateText, kitsCount (número), belongsTo, description. Não invente; omita o que não estiver legível.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extraia doadora, donatária, data/local e quantidade de kits/computadores deste termo de doação.",
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
    const suggestion: DonationTermSuggestion = {};
    const copy = (key: keyof DonationTermSuggestion, max: number) => {
      const v = parsed[key];
      if (typeof v === "string" && v.trim()) {
        (suggestion as Record<string, string>)[key] = v.trim().slice(0, max);
      }
    };
    copy("donorName", 160);
    copy("donorDocument", 24);
    copy("donorCity", 80);
    copy("donorState", 4);
    copy("donorCep", 12);
    copy("donorAddress", 200);
    copy("donorPhone", 40);
    copy("donorEmail", 120);
    copy("donorRepresentativeName", 120);
    copy("donorRepresentativeRole", 80);
    copy("donorRepresentativeCpf", 20);
    copy("donatariaName", 160);
    copy("donatariaDocument", 24);
    copy("donatariaContactName", 120);
    copy("donatariaPhone", 40);
    copy("donatariaEmail", 120);
    copy("donatariaStreet", 200);
    copy("donatariaCity", 80);
    copy("donatariaState", 4);
    copy("donatariaCep", 12);
    copy("placeDateText", 160);
    copy("belongsTo", 160);
    copy("description", 200);
    if (parsed.donatariaZone === "URBANA" || parsed.donatariaZone === "RURAL") {
      suggestion.donatariaZone = parsed.donatariaZone;
    }
    if (typeof parsed.donatedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.donatedAt)) {
      suggestion.donatedAt = parsed.donatedAt;
    }
    if (typeof parsed.kitsCount === "number" && parsed.kitsCount > 0) {
      suggestion.kitsCount = Math.min(500, Math.round(parsed.kitsCount));
    } else if (typeof parsed.kitsCount === "string") {
      const n = Number(parsed.kitsCount.replace(/\D/g, ""));
      if (n > 0) suggestion.kitsCount = Math.min(500, n);
    }
    return { suggestion };
  } catch (e) {
    return {
      suggestion: {},
      warning: e instanceof Error ? e.message : "Falha ao interpretar o termo por visão.",
    };
  }
}

async function tryVisionOnPdfPages(buffer: Buffer): Promise<{
  suggestion: DonationTermSuggestion;
  warning?: string;
} | null> {
  if (!process.env.OPENAI_API_KEY?.trim()) return null;
  try {
    const pages = await renderPdfPagesToPng(buffer, 1);
    if (pages.length === 0) {
      return { suggestion: {}, warning: "Não foi possível renderizar o PDF para visão." };
    }
    return tryVisionSuggestion(pages[0].buffer, "image/png");
  } catch (e) {
    return {
      suggestion: {},
      warning: e instanceof Error ? e.message : "Falha ao preparar páginas para visão.",
    };
  }
}

function mergeSuggestion(
  base: DonationTermSuggestion,
  extra: DonationTermSuggestion,
): DonationTermSuggestion {
  const out: DonationTermSuggestion = { ...base };
  for (const [k, v] of Object.entries(extra) as Array<[keyof DonationTermSuggestion, unknown]>) {
    if (v == null || v === "") continue;
    if (out[k] == null || out[k] === "") {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  // Preferir IGH se qualquer lado indicar
  if (base.templateKind === "IGH" || extra.templateKind === "IGH") {
    out.templateKind = "IGH";
  } else if (!out.templateKind && extra.templateKind) {
    out.templateKind = extra.templateKind;
  }
  if ((out.kitsCount == null || out.kitsCount <= 0) && extra.kitsCount != null && extra.kitsCount > 0) {
    out.kitsCount = extra.kitsCount;
  }
  return out;
}

export async function matchDonationTermParties(
  suggestion: DonationTermSuggestion,
  catalogs: {
    donors: Array<{ id: string; name: string | null; document: string | null }>;
    donatarias: Array<{ id: string; name: string; document: string | null }>;
  },
): Promise<{
  matchedDonorInstitutionId: string | null;
  matchedDonatariaId: string | null;
  donatariaCreateCandidate: DonationTermReadResult["donatariaCreateCandidate"];
}> {
  const donorDoc = onlyDigits(suggestion.donorDocument);
  const donorName = (suggestion.donorName ?? "").trim().toLowerCase();
  let matchedDonorInstitutionId: string | null = null;
  for (const d of catalogs.donors) {
    const dd = onlyDigits(d.document);
    if (donorDoc && dd && donorDoc === dd) {
      matchedDonorInstitutionId = d.id;
      break;
    }
  }
  if (!matchedDonorInstitutionId && donorName) {
    const byName = catalogs.donors.find(
      (d) => (d.name ?? "").trim().toLowerCase() === donorName,
    );
    if (byName) matchedDonorInstitutionId = byName.id;
  }

  const doneeDoc = onlyDigits(suggestion.donatariaDocument);
  const doneeName = (suggestion.donatariaName ?? "").trim().toLowerCase();
  let matchedDonatariaId: string | null = null;
  for (const d of catalogs.donatarias) {
    const dd = onlyDigits(d.document);
    if (doneeDoc && dd && doneeDoc === dd) {
      matchedDonatariaId = d.id;
      break;
    }
  }
  if (!matchedDonatariaId && doneeName) {
    const byName = catalogs.donatarias.find(
      (d) => d.name.trim().toLowerCase() === doneeName,
    );
    if (byName) matchedDonatariaId = byName.id;
  }

  let donatariaCreateCandidate: DonationTermReadResult["donatariaCreateCandidate"] = null;
  if (!matchedDonatariaId && suggestion.donatariaName && suggestion.donatariaName.trim().length >= 2) {
    donatariaCreateCandidate = {
      name: suggestion.donatariaName.trim(),
      document: suggestion.donatariaDocument?.trim() || null,
      email: suggestion.donatariaEmail?.trim() || null,
      phone: suggestion.donatariaPhone?.trim() || null,
      contactName: suggestion.donatariaContactName?.trim() || null,
      street: suggestion.donatariaStreet?.trim() || null,
      city: suggestion.donatariaCity?.trim() || null,
      state: suggestion.donatariaState?.trim() || null,
      cep: suggestion.donatariaCep?.trim() || null,
      zone: suggestion.donatariaZone ?? "URBANA",
    };
  }

  return { matchedDonorInstitutionId, matchedDonatariaId, donatariaCreateCandidate };
}

export async function readDonationTermAttachment(opts: {
  attachmentUrl: string;
  attachmentFileName?: string | null;
  donors: Array<{ id: string; name: string | null; document: string | null }>;
  donatarias: Array<{ id: string; name: string; document: string | null }>;
  templates?: Array<{ id: string; title: string }>;
}): Promise<DonationTermReadResult> {
  const empty = (warnings: string[], suggestion: DonationTermSuggestion = {}): DonationTermReadResult => ({
    suggestion,
    source: "partial",
    warnings,
    matchedDonorInstitutionId: null,
    matchedDonatariaId: null,
    matchedTemplateId: null,
    donatariaCreateCandidate: null,
  });

  const warnings: string[] = [];
  if (!isHttpsUrl(opts.attachmentUrl)) {
    return empty(["URL do anexo inválida (precisa ser HTTPS)."]);
  }

  const fileHint = donatariaNameHintFromFileName(opts.attachmentFileName);

  let res: Response;
  try {
    res = await fetch(opts.attachmentUrl, {
      headers: { Accept: "application/pdf,image/*,*/*" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "falha de rede";
    const suggestion: DonationTermSuggestion = fileHint
      ? { donatariaName: fileHint, description: "Termo de doação de equipamentos", templateKind: "IGH" }
      : {};
    return {
      ...empty(
        [
          `Não foi possível baixar o anexo a tempo (${msg.slice(0, 80)}).`,
          ...(fileHint ? [`Nome da donatária sugerido a partir do arquivo: “${fileHint}”.`] : []),
        ],
        suggestion,
      ),
      donatariaCreateCandidate: fileHint
        ? {
            name: fileHint,
            document: null,
            email: null,
            phone: null,
            contactName: null,
            street: null,
            city: null,
            state: null,
            cep: null,
            zone: "URBANA" as const,
          }
        : null,
      matchedTemplateId: suggestDonationTermTemplateId(
        suggestion.templateKind ?? null,
        opts.templates ?? [],
      ),
    };
  }
  if (!res.ok) {
    return empty([`Não foi possível baixar o anexo (${res.status}).`]);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength === 0) {
    return empty(["Anexo vazio."]);
  }
  if (buffer.byteLength > 12 * 1024 * 1024) {
    return empty(["Anexo muito grande para leitura automática."]);
  }

  const mime = guessMime(opts.attachmentFileName ?? undefined, res.headers.get("content-type"), buffer);
  let suggestion: DonationTermSuggestion = {};
  let source: DonationTermReadResult["source"] = "partial";

  if (mime === "application/pdf") {
    const { text, error } = await tryExtractPdfText(buffer);
    if (error) warnings.push(error);
    if (text.length >= 40) {
      suggestion = extractDonationTermFromText(text);
      source = isDonationTermSuggestionUseful(suggestion) ? "pdf" : "partial";
      if (!isDonationTermSuggestionUseful(suggestion)) {
        warnings.push("Texto do PDF encontrado, mas poucos campos reconhecidos.");
      }
    } else {
      warnings.push("PDF sem texto extraível (escaneado). Usando OCR local…");
    }
  }

  // OCR se faltam campos-chave (data fica na pág. 2 em termos IGH)
  const needsOcr =
    donationTermSuggestionFilledCount(suggestion) < 3 ||
    suggestion.kitsCount == null ||
    !suggestion.donatedAt ||
    !suggestion.donorName ||
    !suggestion.donatariaName;

  if (needsOcr && (mime === "application/pdf" || mime.startsWith("image/"))) {
    const ocr = await tryOcrFromPdfOrImage(buffer, mime);
    if (ocr.warning) warnings.push(ocr.warning);
    if (ocr.text.length >= 40) {
      suggestion = mergeSuggestion(suggestion, extractDonationTermFromText(ocr.text));
      if (isDonationTermSuggestionUseful(suggestion)) source = "ocr";
      else warnings.push("OCR concluiu, mas poucos campos reconhecidos — revise o formulário.");
    }
  }

  if (donationTermSuggestionFilledCount(suggestion) < 3 || suggestion.kitsCount == null) {
    if (mime.startsWith("image/")) {
      const vision = await tryVisionSuggestion(buffer, mime);
      if (vision) {
        if (vision.warning) warnings.push(vision.warning);
        suggestion = mergeSuggestion(suggestion, vision.suggestion);
        if (isDonationTermSuggestionUseful(vision.suggestion)) source = "vision";
      }
    } else if (mime === "application/pdf") {
      const vision = await tryVisionOnPdfPages(buffer);
      if (vision) {
        if (vision.warning) warnings.push(vision.warning);
        suggestion = mergeSuggestion(suggestion, vision.suggestion);
        if (isDonationTermSuggestionUseful(vision.suggestion)) source = "vision";
      } else if (!process.env.OPENAI_API_KEY?.trim() && donationTermSuggestionFilledCount(suggestion) < 3) {
        warnings.push(
          "Leitura por visão (OpenAI) não configurada. O OCR local já foi tentado; revise os campos manualmente se necessário.",
        );
      }
    }
  }

  if (!suggestion.donatariaName && fileHint) {
    suggestion.donatariaName = fileHint;
    warnings.push(`Nome da donatária sugerido a partir do arquivo: “${fileHint}”.`);
  }

  if (!isDonationTermSuggestionUseful(suggestion) && fileHint) {
    suggestion.donatariaName = fileHint;
    suggestion.description = suggestion.description ?? "Termo de doação de equipamentos";
  }

  if (!suggestion.templateKind && suggestion.donorDocument) {
    suggestion.templateKind =
      detectDonationTermTemplateKind("", suggestion.donorDocument) ?? suggestion.templateKind;
  }

  const parties = await matchDonationTermParties(suggestion, {
    donors: opts.donors,
    donatarias: opts.donatarias,
  });

  const matchedTemplateId = suggestDonationTermTemplateId(
    suggestion.templateKind ?? null,
    opts.templates ?? [],
  );
  if (matchedTemplateId) {
    warnings.push(
      suggestion.templateKind === "IGH"
        ? "Modelo sugerido: Termo de doação (IGH)."
        : "Modelo sugerido: Termo de doação (INAC).",
    );
  }
  if (suggestion.kitsCount != null && suggestion.kitsCount > 0) {
    warnings.push(`Quantidade de kits sugerida: ${suggestion.kitsCount}.`);
  }

  return {
    suggestion,
    source,
    warnings,
    matchedTemplateId,
    ...parties,
  };
}
