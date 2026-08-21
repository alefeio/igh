import { requireRole } from "@/lib/auth";
import {
  getCachedDirectorDashboard,
  type DirectorScopeMode,
} from "@/lib/director-dashboard-data";
import { jsonErr, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireRole(["DIRECTOR", "MASTER"]);
  } catch {
    return jsonErr("FORBIDDEN", "Acesso restrito ao perfil Diretor.", 403);
  }

  const url = new URL(request.url);
  const scopeRaw = url.searchParams.get("scope") ?? "current";
  const scope: DirectorScopeMode =
    scopeRaw === "all" || scopeRaw === "cycle" || scopeRaw === "current"
      ? scopeRaw
      : "current";
  const cycleId = url.searchParams.get("cycleId");

  try {
    const data = await getCachedDirectorDashboard({
      scope,
      cycleId,
    });
    return jsonOk(data);
  } catch (e) {
    console.error("[diretor/dashboard]", e);
    return jsonErr("INTERNAL", "Falha ao montar o dashboard executivo.", 500);
  }
}
