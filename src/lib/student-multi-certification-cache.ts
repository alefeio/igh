import { revalidateTag } from "next/cache";

export const MULTI_CERT_CACHE_TAG = "public-multi-certified-students-v1";

export function revalidateMultiCertifiedStudentsCache(): void {
  revalidateTag(MULTI_CERT_CACHE_TAG, "max");
}
