import { requireStaffRead } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  getPedagogicalDashboard,
  type PedagogicalDashboardFilters,
} from "@/lib/pedagogical-dashboard";

function parseBool(value: string | null): boolean | null {
  if (value == null || value === "") return null;
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return null;
}

function parseIntParam(value: string | null): number | null {
  if (value == null || value === "") return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Dashboard pedagógico: resumo por ciclo/turma com filtros.
 * Query: cycleIds (csv), classGroupId, teacherId, courseId, year, cycleNumber,
 * classGroupStatus, isExternal (true|false).
 */
export async function GET(request: Request) {
  try {
    await requireStaffRead();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "UNAUTHENTICATED") return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
    return jsonErr("FORBIDDEN", "Acesso negado.", 403);
  }

  const { searchParams } = new URL(request.url);
  const cycleIdsRaw = searchParams.get("cycleIds")?.trim() ?? "";
  const cycleIds = cycleIdsRaw
    ? cycleIdsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const filters: PedagogicalDashboardFilters = {
    cycleIds,
    classGroupId: searchParams.get("classGroupId")?.trim() || null,
    teacherId: searchParams.get("teacherId")?.trim() || null,
    courseId: searchParams.get("courseId")?.trim() || null,
    year: parseIntParam(searchParams.get("year")),
    cycleNumber: parseIntParam(searchParams.get("cycleNumber")),
    classGroupStatus: searchParams.get("classGroupStatus")?.trim() || null,
    isExternal: parseBool(searchParams.get("isExternal")),
  };

  const payload = await getPedagogicalDashboard(filters);
  return jsonOk(payload);
}
