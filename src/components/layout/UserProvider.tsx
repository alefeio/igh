"use client";

import { createContext, useContext } from "react";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "MASTER" | "ADMIN" | "COORDINATOR" | "TEACHER" | "STUDENT";
  baseRole?: "MASTER" | "ADMIN" | "COORDINATOR" | "TEACHER" | "STUDENT";
  mustChangePassword?: boolean;
  isAdmin?: boolean;
  /** True se o usuário possui perfil de aluno (Student) ativo. */
  hasStudentProfile?: boolean;
  /** True se o usuário possui perfil de professor (Teacher) ativo. */
  hasTeacherProfile?: boolean;
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
