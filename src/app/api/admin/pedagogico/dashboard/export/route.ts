import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireStaffRead } from "@/lib/auth";
import { jsonErr } from "@/lib/http";
import {
  getPedagogicalDashboard,
  type PedagogicalDashboardFilters,
} from "@/lib/pedagogical-dashboard";
import {
  buildPedagogicalDashboardPdf,
  buildPedagogicalDashboardXlsx,
} from "@/lib/pedagogical-dashboard-export";

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

function parseFilters(searchParams: URLSearchParams): PedagogicalDashboardFilters {
  const cycleIdsRaw = searchParams.get("cycleIds")?.trim() ?? "";
  const cycleIds = cycleIdsRaw
    ? cycleIdsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return {
    cycleIds,
    classGroupId: searchParams.get("classGroupId")?.trim() || null,
    teacherId: searchParams.get("teacherId")?.trim() || null,
    courseId: searchParams.get("courseId")?.trim() || null,
    year: parseIntParam(searchParams.get("year")),
    cycleNumber: parseIntParam(searchParams.get("cycleNumber")),
    classGroupStatus: searchParams.get("classGroupStatus")?.trim() || null,
    isExternal: parseBool(searchParams.get("isExternal")),
  };
}

/**
 * Exportação do dashboard pedagógico em Excel ou PDF (?format=xlsx|pdf).
 * Usa os mesmos filtros e o mesmo modelo de dados da API JSON.
 */
export async function GET(request: Request) {
  try {
    await requireStaffRead();
    const { searchParams } = new URL(request.url);
    const formatRaw = (searchParams.get("format") ?? "xlsx").toLowerCase();
    const format = formatRaw === "pdf" ? "pdf" : "xlsx";

    const filters = parseFilters(searchParams);
    const payload = await getPedagogicalDashboard(filters);

    if (filters.cycleIds.length === 0 && filters.year == null && filters.cycleNumber == null) {
      // Ainda assim pode ter sido resolvido via ano/número no get; se ficou vazio, avisa.
      if (payload.turmaRows.length === 0 && payload.summary.some((m) => m.value == null && m.key === "turmas")) {
        return jsonErr(
          "VALIDATION_ERROR",
          "Selecione ao menos um ciclo (ou ano/número) antes de exportar.",
          400,
        );
      }
    }

    const dateStamp = new Date().toISOString().slice(0, 10);

    if (format === "pdf") {
      const buffer = await buildPedagogicalDashboardPdf(payload);
      const fileName = `dashboard-pedagogico-${dateStamp}.pdf`;
      return new Response(Uint8Array.from(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const buffer = await buildPedagogicalDashboardXlsx(payload);
    const fileName = `dashboard-pedagogico-${dateStamp}.xlsx`;
    return new Response(Uint8Array.from(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "Falha ao exportar o dashboard.";
    return jsonErr("INTERNAL_ERROR", msg, 500);
  }
}
