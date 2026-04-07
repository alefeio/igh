import { requireSessionUser } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { countUnreadUserNotifications } from "@/lib/user-notifications";

export async function GET() {
  let userId: string;
  try {
    const user = await requireSessionUser();
    userId = user.id;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") {
      return jsonErr("UNAUTHENTICATED", "Você precisa estar logado.", 401);
    }
    if (msg === "FORBIDDEN") {
      return jsonErr("FORBIDDEN", "Sem permissão.", 403);
    }
    throw e;
  }

  const n = await countUnreadUserNotifications(userId);
  return jsonOk({ hasUnread: n > 0, unreadCount: n });
}
