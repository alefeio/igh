import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { listPendingSiteChanges } from "@/lib/pending-site-change";

export async function GET() {
  await requireRole("MASTER");
  const items = await listPendingSiteChanges();
  return jsonOk({ items });
}
