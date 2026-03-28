import { requireStaffWrite } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api-auth-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import type { LegalDocumentKind } from "@/generated/prisma/client";
import { z } from "zod";

const KINDS: LegalDocumentKind[] = ["TERMS", "PRIVACY", "COOKIE_POLICY"];

const postSchema = z.object({
  kind: z.enum(["TERMS", "PRIVACY", "COOKIE_POLICY"]),
  versionLabel: z.string().trim().min(1).max(64),
  title: z.string().max(500).optional(),
  contentRich: z.string().max(2_000_000).optional(),
});

/** Lista versões de um tipo de documento (todas, para o admin). */
export async function GET(request: Request) {
  try {
    await requireStaffWrite();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") as LegalDocumentKind | null;
  if (!kind || !KINDS.includes(kind)) {
    return jsonErr("VALIDATION_ERROR", "Parâmetro kind inválido (TERMS, PRIVACY ou COOKIE_POLICY).", 400);
  }

  const items = await prisma.legalDocumentVersion.findMany({
    where: { kind },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kind: true,
      versionLabel: true,
      title: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  });

  return jsonOk({ items });
}

/** Cria nova versão em rascunho. */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireStaffWrite();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }
  const raw = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { kind, versionLabel, title, contentRich } = parsed.data;

  const dup = await prisma.legalDocumentVersion.findUnique({
    where: { kind_versionLabel: { kind, versionLabel } },
  });
  if (dup) {
    return jsonErr("DUPLICATE", "Já existe uma versão com este rótulo para este documento.", 409);
  }

  const row = await prisma.legalDocumentVersion.create({
    data: {
      kind,
      versionLabel,
      title: title?.trim() ?? "",
      contentRich: contentRich?.trim() ?? "<p></p>",
      status: "DRAFT",
      createdByUserId: user.id,
    },
    select: {
      id: true,
      kind: true,
      versionLabel: true,
      title: true,
      status: true,
      createdAt: true,
    },
  });

  return jsonOk({ item: row });
}
