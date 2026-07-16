import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import {
  buildMultiClassGroupCertificatesZipBundle,
  parseCertificateZipPages,
  zipResponse,
} from "@/lib/course-certificates-zip";
import { jsonErr } from "@/lib/http";

/**
 * ZIP externo com um .zip por turma selecionada (cada um com PDFs nome-do-aluno.pdf).
 * Body: { classGroupIds: string[], pages?: "front" | "both" }
 */
export async function POST(request: Request) {
  try {
    await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
    const body = (await request.json().catch(() => null)) as {
      classGroupIds?: unknown;
      pages?: unknown;
    } | null;
    const rawIds = Array.isArray(body?.classGroupIds) ? body!.classGroupIds : [];
    const classGroupIds = [
      ...new Set(rawIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)),
    ];
    const pages = parseCertificateZipPages(
      typeof body?.pages === "string" ? body.pages : null,
    );

    if (classGroupIds.length === 0) {
      return jsonErr("VALIDATION_ERROR", "Selecione ao menos uma turma.", 400);
    }

    const { zipBytes, errors, fileCount } = await buildMultiClassGroupCertificatesZipBundle(
      classGroupIds,
      pages,
    );

    if (fileCount === 0) {
      return jsonErr(
        "VALIDATION_ERROR",
        errors.length
          ? `Nenhum certificado gerado. ${errors.slice(0, 3).join("; ")}`
          : "Não há alunos aptos a certificado nas turmas selecionadas.",
        400,
      );
    }

    const zipName = `certificados-${classGroupIds.length}-turmas.zip`;
    return zipResponse(zipBytes, zipName, errors);
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "Falha ao montar o ZIP.";
    return jsonErr("INTERNAL_ERROR", msg, 500);
  }
}
