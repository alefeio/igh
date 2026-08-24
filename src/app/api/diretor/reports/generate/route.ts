import { requireDirectorRead } from "@/lib/diretor/auth";
import { directorApiError, methodNotAllowed } from "@/lib/diretor/http";
import { generateDirectorReport } from "@/lib/diretor/reports/generate";
import { reportsGenerateSchema } from "@/lib/diretor/search-params";

export async function POST(request: Request) {
  try {
    const user = await requireDirectorRead();
    const body = reportsGenerateSchema.parse(await request.json());
    const result = await generateDirectorReport(body, user.viewer, user.id);
    const bytes = typeof result.body === "string" ? Buffer.from(result.body, "utf8") : Buffer.from(result.body);
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": result.mime,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
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
