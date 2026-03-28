import { jsonOk } from "@/lib/http";
import { getPublishedLegalBundle } from "@/lib/legal-documents";

/** Documentos legais atualmente publicados (site público e banner). */
export async function GET() {
  const bundle = await getPublishedLegalBundle();
  return jsonOk({
    terms: bundle.terms,
    privacy: bundle.privacy,
    cookie: bundle.cookie,
  });
}
