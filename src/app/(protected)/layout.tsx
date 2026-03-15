import { redirect } from "next/navigation";

import { ToastProvider } from "@/components/feedback/ToastProvider";
import { RequireChangePassword } from "@/components/layout/RequireChangePassword";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { UserProvider } from "@/components/layout/UserProvider";
import { getSessionUserFromCookie } from "@/lib/auth";
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
  };

  const shellUser = {
    ...user,
    availableRoles,
  };

  return (
    <ToastProvider>
      <UserProvider user={sessionUser}>
        <RequireChangePassword>
          <ResponsiveShell user={shellUser} logoUrl={settings?.logoUrl ?? null}>{children}</ResponsiveShell>
        </RequireChangePassword>
      </UserProvider>
    </ToastProvider>
  );
}
