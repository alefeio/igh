import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createPendingSiteChange } from "@/lib/pending-site-change";
import { siteSettingsSchema } from "@/lib/validators/site";

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);
  try {
    let settings = await prisma.siteSettings.findFirst();
    if (!settings) {
      settings = await prisma.siteSettings.create({ data: {} });
    }
    return jsonOk({ settings });
  } catch (e) {
    return jsonErr("SERVER_ERROR", "Erro ao carregar configurações.", 500);
  }
}

export async function PATCH(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  try {
    const body = await request.json().catch(() => null);
    const parsed = siteSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
    }
    const data = parsed.data as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      clean[k] = v === "" || v === undefined ? null : v;
    }
    if (user.role === "ADMIN") {
      await createPendingSiteChange(user.id, "site_settings", "update", null, clean);
      return jsonOk({
        pending: true,
        message: "Alteração enviada para aprovação do Master.",
      });
    }
    let settings = await prisma.siteSettings.findFirst();
    if (!settings) {
      settings = await prisma.siteSettings.create({ data: clean as never });
    } else {
      settings = await prisma.siteSettings.update({
        where: { id: settings.id },
        data: clean as never,
      });
    }
    return jsonOk({ settings });
  } catch (e) {
    return jsonErr("SERVER_ERROR", "Erro ao salvar configurações.", 500);
  }
}
