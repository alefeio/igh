"use client";

import { createContext, useContext } from "react";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "MASTER" | "ADMIN" | "TEACHER" | "STUDENT";
  mustChangePassword?: boolean;
};

const UserContext = createContext<SessionUser | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser(): SessionUser {
  const u = useContext(UserContext);
  if (!u) throw new Error("useUser deve ser usado dentro de UserProvider");
  return u;
}
