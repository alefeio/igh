import { requireDirectorRead } from "@/lib/diretor/auth";
import { directorApiError, methodNotAllowed } from "@/lib/diretor/http";
import { loadProjects } from "@/lib/diretor/metrics/projects";
import { parseSearchParams, projectsQuerySchema } from "@/lib/diretor/search-params";
import { jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const { viewer } = await requireDirectorRead();
    const q = parseSearchParams(projectsQuerySchema, new URL(request.url));
    const bundle = await loadProjects(q, viewer);
    return jsonOk(bundle);
  } catch (e) {
    return directorApiError(e);
  }
}
export function POST() {
  return methodNotAllowed();
}
export function PATCH() {
  return methodNotAllowed();
}
export function DELETE() {
  return methodNotAllowed();
}
