import type { UserRole } from "@/generated/prisma/client";

export const MASTER_ONLY: UserRole[] = ["MASTER"];
export const MASTER_OR_ADMIN: UserRole[] = ["MASTER", "ADMIN"];
