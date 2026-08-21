import { redirect } from "next/navigation";
import { Suspense } from "react";

import { DirectorMasterPreviewBanner } from "@/components/diretor/DirectorMasterPreviewBanner";
import { DirectorSubnav } from "@/components/diretor/DirectorSubnav";
import { requireSessionUser } from "@/lib/auth";

export default async function DiretorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSessionUser();
  if (user.role !== "DIRECTOR" && user.role !== "MASTER") {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-2">
      <DirectorMasterPreviewBanner />
      <Suspense fallback={null}>
        <DirectorSubnav />
      </Suspense>
      {children}
    </div>
  );
}
