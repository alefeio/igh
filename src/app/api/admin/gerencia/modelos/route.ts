import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { DOCUMENT_TEMPLATE_VARIABLE_HELP } from "@/lib/admin/document-template-vars";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  createDocumentTemplateSchema,
} from "@/lib/validators/admin-documents";

export async function GET() {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const templates = await prisma.documentTemplate.findMany({
    orderBy: [{ type: "asc" }, { title: "asc" }],
  });

  return jsonOk({
    templates,
    variables: DOCUMENT_TEMPLATE_VARIABLE_HELP,
  });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createDocumentTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const template = await prisma.documentTemplate.create({
    data: {
      ...parsed.data,
      createdByUserId: actor.id,
    },
  });

  await createAuditLog({
    entityType: "DocumentTemplate",
    entityId: template.id,
    action: "CREATE",
    diff: { type: template.type, title: template.title },
    performedByUserId: actor.id,
  });

  return jsonOk({ template }, { status: 201 });
}
