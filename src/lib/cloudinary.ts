import { createHash } from "crypto";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const UPLOAD_FOLDER = process.env.CLOUDINARY_UPLOAD_FOLDER ?? "igh/students";

export function getCloudinaryConfig() {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    throw new Error("CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET são obrigatórios.");
  }
  return { cloudName: CLOUD_NAME, apiKey: API_KEY, apiSecret: API_SECRET, uploadFolder: UPLOAD_FOLDER };
}

/**
 * Gera assinatura para upload assinado no Cloudinary.
 * Parâmetros assinados: folder, timestamp (e use_filename se fornecido), ordem alfabética.
 * @see https://cloudinary.com/documentation/upload_images#generating_authentication_signatures
 */
export function generateUploadSignature(params: { folder: string; use_filename?: boolean }): { signature: string; timestamp: number; use_filename?: boolean } {
  const { apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign: Record<string, string | number> = {
    folder: params.folder,
    timestamp,
    ...(params.use_filename === true && { use_filename: "true" }),
  };
  const sorted = Object.keys(toSign)
    .sort()
    .map((k) => `${k}=${toSign[k]}`)
    .join("&");
  const signature = createHash("sha1").update(sorted + apiSecret).digest("hex");
  return { signature, timestamp, ...(params.use_filename === true && { use_filename: true }) };
}

/**
 * Folder completo para upload do aluno: uploadFolder/studentId
 */
export function getStudentUploadFolder(studentId: string): string {
  const { uploadFolder } = getCloudinaryConfig();
  return `${uploadFolder}/${studentId}`.replace(/\/+/g, "/");
}

/**
 * Folder para certificado de matrícula: uploadFolder/enrollments/enrollmentId
 */
export function getEnrollmentCertificateFolder(enrollmentId: string): string {
  const { uploadFolder } = getCloudinaryConfig();
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
): string {
  return `${SITE_UPLOAD_PREFIX}/${kind}`.replace(/\/+/g, "/");
}

export function getSiteUploadFolderWithId(kind: "banners" | "projects" | "news" | "transparency", id: string): string {
  return `${SITE_UPLOAD_PREFIX}/${kind}/${id}`.replace(/\/+/g, "/");
}

/** Pasta para anexos de chamados de suporte: igh/support/{userId} */
export function getSupportUploadFolder(userId: string): string {
  const base = process.env.CLOUDINARY_UPLOAD_FOLDER ?? "igh";
  return `${base}/support/${userId}`.replace(/\/+/g, "/");
}
