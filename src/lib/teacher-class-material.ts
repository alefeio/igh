import { formatDaysShortPtBr } from "@/lib/turma-display";

export const MAX_TEACHER_MATERIAL_BYTES = 80 * 1024 * 1024;

export type TeacherMaterialKind = "pdf" | "ppt" | "other";

const PPT_EXTENSIONS = new Set(["ppt", "pptx", "pps", "ppsx", "pot", "potx"]);

export class MaterialUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaterialUrlError";
  }
}

export function fileExtension(fileName: string): string {
  const base = fileName.trim().split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function sanitizeMaterialFileName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop()?.replace(/[\u0000-\u001f\r\n]/g, "").trim() ?? "";
  return base.slice(0, 180) || "arquivo";
}

export function teacherMaterialKind(fileName: string, mimeType?: string | null): TeacherMaterialKind {
  const ext = fileExtension(fileName);
  const mime = (mimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (
    PPT_EXTENSIONS.has(ext) ||
    mime === "application/vnd.ms-powerpoint" ||
    mime.includes("presentationml") ||
    mime === "application/vnd.openxmlformats-officedocument.presentationml.slideshow" ||
    mime === "application/vnd.ms-powerpoint.presentation.macroenabled.12" ||
    mime === "application/vnd.ms-powerpoint.slideshow.macroenabled.12"
  ) {
    return "ppt";
  }
  return "other";
}

export function materialContentType(
  fileName: string,
  mimeType: string | null | undefined,
  kind: TeacherMaterialKind
): string {
  if (kind === "pdf") return "application/pdf";
  const ext = fileExtension(fileName);
  const byExt: Record<string, string> = {
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    pps: "application/vnd.ms-powerpoint",
    ppsx: "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
    pot: "application/vnd.ms-powerpoint",
    potx: "application/vnd.openxmlformats-officedocument.presentationml.template",
  };
  const mime = (mimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (
    mime &&
    mime !== "application/octet-stream" &&
    mime !== "text/html" &&
    mime !== "application/xhtml+xml" &&
    !mime.startsWith("text/")
  ) {
    return mime;
  }
  return byExt[ext] ?? "application/octet-stream";
}

export function contentDisposition(fileName: string, download: boolean): string {
  const cleaned = sanitizeMaterialFileName(fileName).replace(/["\\]/g, "");
  const fallback = cleaned.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 150) || "arquivo";
  return `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(cleaned)}`;
}

/** Visualizador do PowerPoint no navegador (arquivo precisa ser HTTPS público). */
export function officePresentationEmbedUrl(fileUrl: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

function ipv4Parts(host: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const parts = [1, 2, 3, 4].map((index) => Number(match[index]));
  if (parts.some((part) => part > 255)) return null;
  return parts;
}

/** Bloqueia localhost, rede privada e endereços de metadata (SSRF). */
export function isBlockedAddress(address: string): boolean {
  const host = address.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0] ?? "";
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    host === "0.0.0.0"
  ) {
    return true;
  }
  const v4 = ipv4Parts(host);
  if (v4) {
    const [a, b] = v4;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (host.includes(":")) {
    if (host === "::1" || host === "::") return true;
    if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return true;
    if (host.startsWith("::ffff:")) return isBlockedAddress(host.slice("::ffff:".length));
  }
  return false;
}

/** Aceita só HTTPS público, sem usuário/senha e sem porta fora da 443. */
export function assertPublicHttpsUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new MaterialUrlError("Endereço do arquivo inválido.");
  }
  if (url.protocol !== "https:") throw new MaterialUrlError("O arquivo precisa estar em um endereço HTTPS.");
  if (url.username || url.password) throw new MaterialUrlError("Endereço do arquivo inválido.");
  if (url.port && url.port !== "443") throw new MaterialUrlError("Endereço do arquivo inválido.");
  if (isBlockedAddress(url.hostname)) throw new MaterialUrlError("Endereço de arquivo não permitido.");
  return url.toString();
}

export type TeacherMaterialDto = {
  id: string;
  fileName: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  kind: TeacherMaterialKind;
  /** Professor a quem o arquivo pertence. */
  ownerName: string;
  /** Dias e horário da turma de origem. */
  classLabel: string;
  /** Arquivo anexado na turma que está aberta. */
  fromThisClass: boolean;
};

/** Rótulo curto da turma (dias e horário) para identificar o material de outro professor. */
export function teacherMaterialClassLabel(input: {
  daysOfWeek: string[];
  startTime: string | null;
  endTime: string | null;
}): string {
  const days = formatDaysShortPtBr(input.daysOfWeek ?? []);
  const time = input.startTime && input.endTime ? `${input.startTime}–${input.endTime}` : "";
  return [days === "—" ? "" : days, time].filter(Boolean).join(" · ");
}

export function toTeacherMaterialDto(
  row: {
    id: string;
    fileName: string;
    url: string;
    mimeType: string | null;
    sizeBytes: number | null;
    createdAt: Date;
  },
  extra?: { ownerName?: string; classLabel?: string; fromThisClass?: boolean }
): TeacherMaterialDto {
  return {
    id: row.id,
    fileName: row.fileName,
    url: row.url,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
    kind: teacherMaterialKind(row.fileName, row.mimeType),
    ownerName: extra?.ownerName?.trim() || "",
    classLabel: extra?.classLabel?.trim() || "",
    fromThisClass: extra?.fromThisClass === true,
  };
}
