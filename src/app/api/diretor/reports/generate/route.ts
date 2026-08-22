import { requireDirectorRead } from "@/lib/diretor/auth";
import { directorApiError, methodNotAllowed } from "@/lib/diretor/http";
import { generateDirectorReport } from "@/lib/diretor/reports/generate";
import { reportsGenerateSchema } from "@/lib/diretor/search-params";
import { jsonOk } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const user = await requireDirectorRead();
    const body = reportsGenerateSchema.parse(await request.json());
    const result = await generateDirectorReport(body, user.viewer, user.id);
    return jsonOk({
      filename: result.filename,
      format: result.format,
      report: result.report,
      body: result.body,
    });
  } catch (e) {
    return directorApiError(e);
  }
}

export function GET() {
  return methodNotAllowed();
}
export function PATCH() {
  return methodNotAllowed();
}
export function DELETE() {
  return methodNotAllowed();
}
