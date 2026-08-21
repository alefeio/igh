"use client";

import { createContext, useContext } from "react";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "MASTER" | "GENERAL_ADMIN" | "ADMIN" | "ADMIN_MANAGER" | "SITE_ADMIN" | "POLO_COORDINATOR" | "DIRECTOR" | "TEACHER" | "STUDENT";
  baseRole?: "MASTER" | "GENERAL_ADMIN" | "ADMIN" | "ADMIN_MANAGER" | "SITE_ADMIN" | "POLO_COORDINATOR" | "DIRECTOR" | "TEACHER" | "STUDENT";
  mustChangePassword?: boolean;
  isAdmin?: boolean;
  isSiteAdmin?: boolean;
  isAdminManager?: boolean;
  isPoloCoordinator?: boolean;
  /** True se o usuário possui perfil de aluno (Student) ativo. */
  hasStudentProfile?: boolean;
  /** True se o usuário possui perfil de professor (Teacher) ativo. */
  hasTeacherProfile?: boolean;
  /** True se o usuário tem ficha de colaborador ativa na Gerência. */
  hasEmployeeProfile?: boolean;
  /** Cargo da ficha de colaborador ativa (quando houver). */
  employeePosition?: string | null;
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
