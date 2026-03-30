import { requireSessionUser } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { countUnreadUserNotifications } from "@/lib/user-notifications";

export async function GET() {
  const user = await requireSessionUser();
  const n = await countUnreadUserNotifications(user.id);
  return jsonOk({ hasUnread: n > 0, unreadCount: n });
}
