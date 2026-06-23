import { redirect } from "next/navigation";

import { PageVisitTracker } from "@/components/activity/PageVisitTracker";
import { ToastProvider } from "@/components/feedback/ToastProvider";
import { LegalConsentBanner } from "@/components/site/LegalConsentBanner";
import { RequireChangePassword } from "@/components/layout/RequireChangePassword";
import { StudentSuspensionGate } from "@/components/layout/StudentSuspensionGate";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { UserProvider } from "@/components/layout/UserProvider";
import { getSessionUserFromCookie } from "@/lib/auth";
import { getStudentSuspensionInfo } from "@/lib/student-suspension";
import { getSiteSettings } from "@/lib/site-data";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [user, settings] = await Promise.all([
    getSessionUserFromCookie(),
    getSiteSettings(),
  ]);
  if (!user) {
    redirect("/login");
  }

  const sessionUser = {
    ...user,
    mustChangePassword: (user as { mustChangePassword?: boolean }).mustChangePassword ?? false,
  };

  /** Perfis que o usuário pode assumir (calculado no servidor para o select do menu). */
  const availableRoles = {
    canMaster: user.baseRole === "MASTER",
    canStudent: user.hasStudentProfile === true,
    canTeacher: user.hasTeacherProfile === true,
    canAdmin: user.isAdmin === true || user.baseRole === "ADMIN",
    canCoordinator: user.baseRole === "COORDINATOR",
  };

  const shellUser = {
    ...user,
    availableRoles,
  };

  const studentSuspension =
    user.role === "STUDENT" ? await getStudentSuspensionInfo(user.id) : null;

  return (
    <ToastProvider>
      <UserProvider user={sessionUser}>
        <PageVisitTracker />
        <RequireChangePassword>
          <ResponsiveShell user={shellUser} logoUrl={settings?.logoUrl ?? null}>
            <StudentSuspensionGate suspension={studentSuspension}>{children}</StudentSuspensionGate>
          </ResponsiveShell>
          <LegalConsentBanner />
        </RequireChangePassword>
      </UserProvider>
    </ToastProvider>
  );
}
