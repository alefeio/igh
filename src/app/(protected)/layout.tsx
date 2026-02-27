import { redirect } from "next/navigation";

import { ToastProvider } from "@/components/feedback/ToastProvider";
import { RequireChangePassword } from "@/components/layout/RequireChangePassword";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { UserProvider } from "@/components/layout/UserProvider";
import { getSessionUserFromCookie } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUserFromCookie();
  if (!user) {
    redirect("/login");
  }

  const sessionUser = {
    ...user,
    mustChangePassword: (user as { mustChangePassword?: boolean }).mustChangePassword ?? false,
  };

  return (
    <ToastProvider>
      <UserProvider user={sessionUser}>
        <RequireChangePassword>
          <ResponsiveShell user={user}>{children}</ResponsiveShell>
        </RequireChangePassword>
      </UserProvider>
    </ToastProvider>
  );
}
