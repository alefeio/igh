import "server-only";

/** Prefixo lógico no nosso sistema (matrículas, anexos, etc.) — não é enviado à API Apimages. */
const UPLOAD_FOLDER = process.env.APIMG_UPLOAD_FOLDER?.trim() || "igh/students";

export function getApimagesConfig() {
  const uploadUrl = process.env.APIMG_UPLOAD_URL?.trim();
  const apiKey = process.env.APIMG_API_KEY?.trim();
  if (!uploadUrl || !apiKey) {
    throw new Error("APIMG_UPLOAD_URL e APIMG_API_KEY são obrigatórios.");
  }
  return { uploadUrl, apiKey, uploadFolder: UPLOAD_FOLDER };
}

/**
 * Segmento de caminho interno (organização no app): uploadFolder/studentId — não é campo da API Apimages.
 */
export function getStudentUploadFolder(studentId: string): string {
  const { uploadFolder } = getApimagesConfig();
  return `${uploadFolder}/${studentId}`.replace(/\/+/g, "/");
}

/**
 * Pasta para certificado de matrícula: uploadFolder/enrollments/enrollmentId
 */
export function getEnrollmentCertificateFolder(enrollmentId: string): string {
  const { uploadFolder } = getApimagesConfig();
  return `${uploadFolder}/enrollments/${enrollmentId}`.replace(/\/+/g, "/");
}

/** Prefixos para documentação/organização no projeto (não enviados ao POST /v1/upload). */
const SITE_UPLOAD_PREFIX = "igh/site";

export function getSiteUploadFolder(
  kind:
    | "logo"
    | "favicon"
    | "banners"
    | "partners"
    | "formations"
    | "projects"
    | "testimonials"
    | "news"
    | "transparency"
    | "about"
    | "inscreva"
    | "contato"
    | "teachers"
    | "onboarding"
    | "legal",
): string {
  return `${SITE_UPLOAD_PREFIX}/${kind}`.replace(/\/+/g, "/");
}

export function getSiteUploadFolderWithId(kind: "banners" | "projects" | "news" | "transparency", id: string): string {
  return `${SITE_UPLOAD_PREFIX}/${kind}/${id}`.replace(/\/+/g, "/");
}

/** Pasta para anexos de chamados de suporte: base/support/{userId} */
export function getSupportUploadFolder(userId: string): string {
  const base = process.env.APIMG_UPLOAD_FOLDER?.trim() || "igh";
  return `${base}/support/${userId}`.replace(/\/+/g, "/");
}

/** Pasta para anexos de reportes à coordenação: base/coordinator-reports/{userId} */
export function getCoordinatorReportUploadFolder(userId: string): string {
  const base = process.env.APIMG_UPLOAD_FOLDER?.trim() || "igh";
  return `${base}/coordinator-reports/${userId}`.replace(/\/+/g, "/");
}
