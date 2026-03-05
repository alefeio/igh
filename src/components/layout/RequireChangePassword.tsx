"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "./UserProvider";

export function RequireChangePassword({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (user.mustChangePassword && pathname !== "/trocar-senha") {
      router.replace("/trocar-senha");
    }
  }, [user.mustChangePassword, pathname, router]);

  if (user.mustChangePassword && pathname !== "/trocar-senha") {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--text-secondary)]">
        Redirecionando para troca de senha...
      </div>
    );
  }

  return <>{children}</>;
}
