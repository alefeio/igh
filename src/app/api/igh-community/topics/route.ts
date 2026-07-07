import { getSessionUserFromCookie } from "@/lib/auth";
import {
  getCommunityViewerCapabilities,
  listApprovedCommunityTopics,
  mapTopicRow,
} from "@/lib/igh-community";
import { jsonOk } from "@/lib/http";

/** Leitura pública da comunidade (visitantes e usuários logados). */
export async function GET(request: Request) {
  const user = await getSessionUserFromCookie();
  const caps = getCommunityViewerCapabilities(user);

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const tag = searchParams.get("tag")?.trim().toLowerCase() ?? null;

  const topics = await listApprovedCommunityTopics(kind, tag);

  return jsonOk({
    viewer: caps,
    canParticipate: caps.canCreateTopics,
    topics: topics.map((t) => mapTopicRow({ ...t, _count: { replies: t.replies.length } }, user?.id ?? null)),
  });
}
