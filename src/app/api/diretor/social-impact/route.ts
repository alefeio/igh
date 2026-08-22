import { requireDirectorRead } from "@/lib/diretor/auth";
import { directorApiError, methodNotAllowed } from "@/lib/diretor/http";
import { loadSocialImpact } from "@/lib/diretor/metrics/social";
import { parseSearchParams, socialQuerySchema } from "@/lib/diretor/search-params";
import { jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const { viewer } = await requireDirectorRead();
    const q = parseSearchParams(socialQuerySchema, new URL(request.url));
    const bundle = await loadSocialImpact(q, viewer);
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
