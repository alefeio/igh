import { redirect } from "next/navigation";

import { ToastProvider } from "@/components/feedback/ToastProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { getSessionUserFromCookie } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUserFromCookie();
  if (!user) {
    redirect("/login");
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-zinc-50">
        <Sidebar user={user} />
        <main className="flex-1">
          <div className="container-page">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
