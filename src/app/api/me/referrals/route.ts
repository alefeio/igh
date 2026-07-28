import { requireSessionUser } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { listReferralsForUser } from "@/lib/student-referrals";

/** Código de indicação do usuário logado + lista de indicados e pontos. */
export async function GET() {
  const user = await requireSessionUser();
  const data = await listReferralsForUser(user.id);
  return jsonOk(data);
}
