import { boardApiErrorResponse } from "@/lib/board-activities-http";
import { listEligibleAssignees, requireBoardAccess } from "@/lib/board-activities-server";
import { jsonOk } from "@/lib/http";

export async function GET() {
  try {
    await requireBoardAccess();
    const assignees = await listEligibleAssignees();
    return jsonOk({
      assignees: assignees.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        canCreateBoardTasks: u.canCreateBoardTasks,
      })),
    });
  } catch (e) {
    const auth = boardApiErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
