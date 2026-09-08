import "server-only";

import { prisma } from "@/lib/prisma";

export const REFERRER_SEARCH_MIN_LENGTH = 3;
export const REFERRER_SEARCH_MAX_RESULTS = 8;

export type ReferrerCandidate = {
  id: string;
  name: string;
  /** Contatos sempre mascarados: servem apenas para desambiguar homônimos. */
  emailMasked: string | null;
  phoneMasked: string | null;
  roleLabel: string;
};

/** `joao.silva@gmail.com` -> `jo***@gmail.com` */
export function maskEmail(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase();
  if (!value || !value.includes("@")) return null;
  const [local, domain] = value.split("@");
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

/** `91999998888` -> `(91) *****-8888` */
export function maskPhone(phone: string | null | undefined): string | null {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (digits.length < 10) return null;
  const ddd = digits.slice(0, 2);
  const last4 = digits.slice(-4);
  const hidden = "*".repeat(digits.length - 6);
  return `(${ddd}) ${hidden}-${last4}`;
}

function roleLabelFor(role: string, isSiteAdmin: boolean): string {
  if (role === "STUDENT") return "Aluno";
  if (role === "TEACHER") return "Professor";
  if (isSiteAdmin) return "Equipe";
  return "Equipe";
}

/**
 * Busca usuários cadastrados que podem ser informados como indicadores.
 * Nunca aceita busca vazia e nunca retorna contato completo (LGPD).
 */
export async function searchReferrerCandidates(
  rawQuery: string,
  excludeUserId?: string | null,
): Promise<ReferrerCandidate[]> {
  const q = rawQuery.trim();
  if (q.length < REFERRER_SEARCH_MIN_LENGTH) return [];

  const digits = q.replace(/\D/g, "");
  const or: Array<Record<string, unknown>> = [
    { name: { contains: q, mode: "insensitive" } },
    { email: { contains: q, mode: "insensitive" } },
  ];
  if (digits.length >= 4) or.push({ whatsapp: { contains: digits } });

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      OR: or,
    },
    orderBy: { name: "asc" },
    take: REFERRER_SEARCH_MAX_RESULTS,
    select: { id: true, name: true, email: true, whatsapp: true, role: true, isSiteAdmin: true },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    emailMasked: maskEmail(u.email),
    phoneMasked: maskPhone(u.whatsapp),
    roleLabel: roleLabelFor(u.role, u.isSiteAdmin),
  }));
}

export type ResolvedReferrer =
  | { ok: true; referrerUserId: string | null; referrerName: string | null }
  | { ok: false; message: string };

/**
 * Valida a indicação de uma inscrição em evento.
 * O indicador precisa ser um usuário ativo já cadastrado, e não pode ser o próprio inscrito.
 */
export async function resolveHolidayEventReferrer(params: {
  holiday: { allowsReferral: boolean; requiresReferral: boolean };
  referrerUserId?: string | null;
  referrerCode?: string | null;
  selfUserId?: string | null;
  selfEmail?: string | null;
  selfPhone?: string | null;
  /** Inscrições feitas pela equipe não são obrigadas a informar indicador. */
  skipRequirement?: boolean;
}): Promise<ResolvedReferrer> {
  const { holiday } = params;

  if (!holiday.allowsReferral) {
    return { ok: true, referrerUserId: null, referrerName: null };
  }

  let referrerId = params.referrerUserId?.trim() || null;

  const code = params.referrerCode?.trim();
  if (!referrerId && code) {
    const byCode = await prisma.userReferralCode.findUnique({
      where: { code },
      select: { userId: true },
    });
    referrerId = byCode?.userId ?? null;
    if (!referrerId) {
      return { ok: false, message: "Link de indicação inválido ou expirado." };
    }
  }

  if (!referrerId) {
    if (holiday.requiresReferral && !params.skipRequirement) {
      return { ok: false, message: "Informe quem indicou você para este evento." };
    }
    return { ok: true, referrerUserId: null, referrerName: null };
  }

  const referrer = await prisma.user.findFirst({
    where: { id: referrerId, isActive: true },
    select: { id: true, name: true, email: true, whatsapp: true },
  });
  if (!referrer) {
    return { ok: false, message: "O indicador informado não está cadastrado no sistema." };
  }

  if (params.selfUserId && referrer.id === params.selfUserId) {
    return { ok: false, message: "Você não pode indicar a si mesmo." };
  }

  const selfEmail = params.selfEmail?.trim().toLowerCase();
  if (selfEmail && referrer.email.toLowerCase() === selfEmail) {
    return { ok: false, message: "Você não pode indicar a si mesmo." };
  }

  const selfPhone = params.selfPhone?.replace(/\D/g, "");
  if (selfPhone && selfPhone.length >= 10 && referrer.whatsapp?.replace(/\D/g, "") === selfPhone) {
    return { ok: false, message: "Você não pode indicar a si mesmo." };
  }

  return { ok: true, referrerUserId: referrer.id, referrerName: referrer.name };
}

/** Dados públicos (mascarados) de um indicador já resolvido, para pré-preencher o formulário. */
export async function describeReferrerByCode(code: string): Promise<ReferrerCandidate | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const row = await prisma.userReferralCode.findUnique({
    where: { code: trimmed },
    select: {
      user: {
        select: { id: true, name: true, email: true, whatsapp: true, role: true, isSiteAdmin: true, isActive: true },
      },
    },
  });
  const user = row?.user;
  if (!user?.isActive) return null;

  return {
    id: user.id,
    name: user.name,
    emailMasked: maskEmail(user.email),
    phoneMasked: maskPhone(user.whatsapp),
    roleLabel: roleLabelFor(user.role, user.isSiteAdmin),
  };
}
