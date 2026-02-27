import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  generateUploadSignature,
  getCloudinaryConfig,
  getStudentUploadFolder,
  getEnrollmentCertificateFolder,
} from "@/lib/cloudinary";
import { z } from "zod";

const bodySchema = z.object({
  studentId: z.string().min(1).optional(),
  enrollmentId: z.string().uuid().optional(),
  attachmentType: z.enum(["ID_DOCUMENT", "ADDRESS_PROOF"]).optional(),
}).refine((d) => (d.studentId != null) !== (d.enrollmentId != null), {
  message: "Informe studentId ou enrollmentId (apenas um).",
});

export async function POST(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Dados inválidos",
      400
    );
  }

  const { studentId, enrollmentId } = parsed.data;

  if (enrollmentId) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true },
    });
    if (!enrollment) {
      return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
    }
    try {
      const { apiKey, cloudName } = getCloudinaryConfig();
      const folder = getEnrollmentCertificateFolder(enrollmentId);
      const { signature, timestamp } = generateUploadSignature({ folder });
      return jsonOk({ timestamp, signature, apiKey, cloudName, folder });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao gerar assinatura.";
      return jsonErr("CONFIG_ERROR", message, 500);
    }
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId! },
    select: { id: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }

  try {
    const { apiKey, cloudName } = getCloudinaryConfig();
    const folder = getStudentUploadFolder(studentId!);
    const { signature, timestamp } = generateUploadSignature({ folder });

    return jsonOk({
      timestamp,
      signature,
      apiKey,
      cloudName,
      folder,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gerar assinatura.";
    return jsonErr("CONFIG_ERROR", message, 500);
  }
}
