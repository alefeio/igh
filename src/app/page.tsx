import { redirect } from "next/navigation";

import { getSessionUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await getSessionUserFromCookie();
  if (session) {
    redirect("/dashboard");
  }

  const usersCount = await prisma.user.count();
  if (usersCount === 0) {
    redirect("/setup");
  }

  redirect("/login");
}
