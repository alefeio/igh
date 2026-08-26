/**
 * Leitura de PDF/imagem de termo de doação para pré-preenchimento do formulário.
 *
 * Pipeline: texto PDF (pdf-parse) → Vision (OpenAI) se texto insuficiente e OPENAI_API_KEY existir.
 * Não persiste doação — só devolve sugestões para revisão.
 */
import "server-only";

import {
  donationTermSuggestionFilledCount,
  extractDonationTermFromText,
  isDonationTermSuggestionUseful,
  type DonationTermSuggestion,
} from "@/lib/donation-term-parse";

export type { DonationTermSuggestion };

export type DonationTermReadResult = {
  suggestion: DonationTermSuggestion;
  source: "pdf" | "vision" | "partial";
  warnings: string[];
  matchedDonorInstitutionId: string | null;
  matchedDonatariaId: string | null;
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
      return { text };
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    console.error("[donation-term-read] pdf-parse failed:", msg);
    return { text: "", error: `Falha ao extrair texto do PDF (${msg.slice(0, 120)}).` };
  }
}

async function tryVisionSuggestion(
  buffer: Buffer,
  mime: string,
): Promise<{ suggestion: DonationTermSuggestion; warning?: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      suggestion: {},
      warning:
        "Leitura por imagem indisponível (defina OPENAI_API_KEY). Em PDFs escaneados, preencha manualmente.",
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
}): Promise<DonationTermReadResult> {
  const warnings: string[] = [];
  if (!isHttpsUrl(opts.attachmentUrl)) {
    return {
      suggestion: {},
      source: "partial",
      warnings: ["URL do anexo inválida (precisa ser HTTPS)."],
      matchedDonorInstitutionId: null,
      matchedDonatariaId: null,
      donatariaCreateCandidate: null,
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
      matchedDonorInstitutionId: null,
      matchedDonatariaId: null,
      donatariaCreateCandidate: null,
    };
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength === 0) {
    return {
      suggestion: {},
      source: "partial",
      warnings: ["Anexo vazio."],
      matchedDonorInstitutionId: null,
      matchedDonatariaId: null,
      donatariaCreateCandidate: null,
    };
  }
  if (buffer.byteLength > 12 * 1024 * 1024) {
    return {
      suggestion: {},
      source: "partial",
      warnings: ["Anexo muito grande para leitura automática."],
      matchedDonorInstitutionId: null,
      matchedDonatariaId: null,
      donatariaCreateCandidate: null,
    };
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
      warnings.push(
        "PDF sem texto extraível (provável escaneado). Tentando leitura por imagem se disponível…",
      );
    }
  }

  const needVision =
    donationTermSuggestionFilledCount(suggestion) < 3 &&
    (mime.startsWith("image/") || mime === "application/pdf");

  if (needVision) {
    // Para PDF escaneado, visão em página única via data URL do PDF costuma falhar;
    // aceitamos imagem direta; para PDF só avisamos se OPENAI não ajudar.
    if (mime.startsWith("image/")) {
      const vision = await tryVisionSuggestion(buffer, mime);
      if (vision) {
        if (vision.warning) warnings.push(vision.warning);
        suggestion = mergeSuggestion(suggestion, vision.suggestion);
        if (isDonationTermSuggestionUseful(vision.suggestion)) source = "vision";
      }
    } else if (mime === "application/pdf" && donationTermSuggestionFilledCount(suggestion) < 3) {
      const vision = await tryVisionSuggestion(buffer, "application/pdf");
      if (vision) {
        if (vision.warning) warnings.push(vision.warning);
        suggestion = mergeSuggestion(suggestion, vision.suggestion);
        if (isDonationTermSuggestionUseful(vision.suggestion)) source = "vision";
      }
    }
  }

  const parties = await matchDonationTermParties(suggestion, {
    donors: opts.donors,
    donatarias: opts.donatarias,
  });

  return {
    suggestion,
    source,
    warnings,
    ...parties,
  };
}
