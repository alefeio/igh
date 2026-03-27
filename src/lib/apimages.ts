import "server-only";

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
 * Pasta para anexos do aluno: uploadFolder/studentId
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
    | "onboarding",
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
