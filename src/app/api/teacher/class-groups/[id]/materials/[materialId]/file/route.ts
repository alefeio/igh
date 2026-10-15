import { authErrorResponse } from "@/lib/api-auth-guard";
import { jsonErr } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  MaterialUrlError,
  contentDisposition,
  materialContentType,
  teacherMaterialKind,
} from "@/lib/teacher-class-material";
import { fetchPublicHttps } from "@/lib/teacher-class-material-fetch";
import { requireReadableClassGroup } from "@/lib/teacher-class-group-access";

export const dynamic = "force-dynamic";

const MAX_STREAM_BYTES = 120 * 1024 * 1024;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    const { id: classGroupId, materialId } = await context.params;
    const access = await requireReadableClassGroup(classGroupId);
    if ("error" in access) return access.error;

    const material = await prisma.classGroupTeacherMaterial.findFirst({
      where: { id: materialId, classGroupId },
      select: { fileName: true, url: true, mimeType: true },
    });
    if (!material) return jsonErr("NOT_FOUND", "Material não encontrado.", 404);

    const kind = teacherMaterialKind(material.fileName, material.mimeType);
    const download =
      new URL(request.url).searchParams.get("download") === "1" || kind !== "pdf";

    let upstream: Response;
    try {
      upstream = await fetchPublicHttps(material.url);
    } catch (e) {
      const message = e instanceof MaterialUrlError ? e.message : "Não foi possível abrir o arquivo.";
      return jsonErr("UPSTREAM", message, 502);
    }
    if (!upstream.ok || !upstream.body) {
      return jsonErr("UPSTREAM", "Não foi possível abrir o arquivo.", 502);
    }

    const lengthHeader = upstream.headers.get("content-length");
    const length = lengthHeader ? Number(lengthHeader) : 0;
    if (Number.isFinite(length) && length > MAX_STREAM_BYTES) {
      return jsonErr("PAYLOAD_TOO_LARGE", "Arquivo grande demais para abrir aqui.", 413);
    }

    const headers = new Headers();
    headers.set("Content-Type", materialContentType(material.fileName, material.mimeType, kind));
    headers.set("Content-Disposition", contentDisposition(material.fileName, download));
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cache-Control", "private, max-age=300");

    return new Response(upstream.body, { status: 200, headers });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    return jsonErr("INTERNAL", "Não foi possível abrir o arquivo.", 500);
  }
}
