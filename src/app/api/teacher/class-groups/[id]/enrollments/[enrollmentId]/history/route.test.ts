import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/class-group-teachers", () => ({
  classGroupTeacherAccessWhere: () => ({ teacherId: "professor-1" }),
}));
vi.mock("@/lib/enrollment-attendance-summary", () => ({
  getEnrollmentAttendanceSummaries: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/enrollment-history-notifications", () => ({
  notifyEnrollmentHistoryEntry: vi.fn(async () => {}),
}));
vi.mock("@/lib/prisma", () => {
  const db = {
    teacher: { findFirst: vi.fn() },
    enrollment: { findFirst: vi.fn() },
    enrollmentHistoryEntry: { findUnique: vi.fn(), create: vi.fn() },
    $queryRaw: vi.fn(async () => [{ id: "matricula-1" }]),
  };
  return {
    prisma: {
      ...db,
      $transaction: vi.fn(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)),
    },
  };
});

import { requireRole } from "@/lib/auth";
import { buildAdministrativeRecord } from "@/lib/busca-ativa";
import { notifyEnrollmentHistoryEntry } from "@/lib/enrollment-history-notifications";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const now = new Date("2026-10-29T12:00:00.000Z");
const revision = [
  "usuario-1",
  "Professor Teste",
  now.toISOString(),
  now.toISOString(),
  now.toISOString(),
  "",
  now.toISOString(),
  now.toISOString(),
  0,
  0,
  0,
  0,
].join(":");
const ctx = { params: Promise.resolve({ id: "turma-1", enrollmentId: "matricula-1" }) };

function ownedEnrollment(
  status: string,
  { isPreEnrollment = false, deletedAt = null }: { isPreEnrollment?: boolean; deletedAt?: Date | null } = {},
) {
  return {
    id: "matricula-1",
    status,
    isPreEnrollment,
    updatedAt: now,
    student: { updatedAt: now, deletedAt },
    classGroup: {
      updatedAt: now,
      course: { updatedAt: now },
      cycle: { updatedAt: now },
      poloLocation: null,
    },
  };
}

function post(body: object) {
  return POST(
    new Request("http://local/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    ctx,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue({
    id: "usuario-1",
    name: "Professor Teste",
    role: "TEACHER",
  } as never);
  vi.mocked(prisma.teacher.findFirst).mockResolvedValue({ id: "professor-1" } as never);
  vi.mocked(prisma.enrollment.findFirst).mockResolvedValue(ownedEnrollment("ACTIVE") as never);
});

describe("registro de busca ativa no histórico existente", () => {
  it("salva com as colunas existentes e reutiliza o ID no retry", async () => {
    const recordBody = buildAdministrativeRecord({
      type: "CONTATO_REALIZADO",
      text: "Mensagem final revisada",
      factDate: "2026-10-29",
      channel: "WhatsApp",
      result: "AGUARDANDO_RESPOSTA",
      authorName: "Professor Teste",
      templateId: "ausencia-direta",
      templateVersion: 1,
    });
    const stored = {
      id: requestId,
      enrollmentId: "matricula-1",
      authorId: "usuario-1",
      kind: "BUSCA_ATIVA",
      body: recordBody,
      createdAt: now,
      author: { name: "Professor Teste" },
    };
    vi.mocked(prisma.enrollmentHistoryEntry.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(stored as never);
    vi.mocked(prisma.enrollmentHistoryEntry.create).mockResolvedValue(stored as never);
    const payload = {
      body: "Mensagem final revisada",
      contactType: "CONTATO_REALIZADO",
      factDate: "2026-10-29",
      channel: "WhatsApp",
      result: "AGUARDANDO_RESPOSTA",
      templateId: "ausencia-direta",
      templateVersion: 1,
      revision,
      requestId,
    };
    expect((await post(payload)).status).toBe(201);
    expect((await post(payload)).status).toBe(200);
    expect(prisma.enrollmentHistoryEntry.create).toHaveBeenCalledTimes(1);
    expect(notifyEnrollmentHistoryEntry).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.enrollmentHistoryEntry.create).mock.calls[0][0].data).toEqual({
      id: requestId,
      enrollmentId: "matricula-1",
      authorId: "usuario-1",
      kind: "BUSCA_ATIVA",
      body: recordBody,
    });
    expect(recordBody).toContain("Resultado informado: Aguardando resposta");
  });

  it("nega matrícula fora da turma antes de gravar", async () => {
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue(null);
    const response = await post({ body: "Informação livre" });
    expect(response.status).toBe(404);
    expect(prisma.enrollmentHistoryEntry.create).not.toHaveBeenCalled();
  });
  it("nega registro de busca ativa cancelado e preserva ocorrência administrativa explícita", async () => {
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue(ownedEnrollment("CANCELLED") as never);
    const denied = await post({
      body: "Mensagem preparada",
      contactType: "CONTATO_REALIZADO",
      requestId,
      revision,
    });
    expect(denied.status).toBe(404);
    expect(prisma.enrollmentHistoryEntry.create).not.toHaveBeenCalled();
    vi.mocked(prisma.enrollmentHistoryEntry.create).mockResolvedValue({
      id: "livre",
      kind: "OCORRENCIA",
      body: "Observação administrativa",
      createdAt: now,
      author: { name: "Professor Teste" },
    } as never);
    const allowed = await post({ body: "Observação administrativa", kind: "OCORRENCIA" });
    expect(allowed.status).toBe(201);
    expect(vi.mocked(prisma.enrollmentHistoryEntry.create).mock.calls[0][0].data).toEqual({
      enrollmentId: "matricula-1",
      authorId: "usuario-1",
      kind: "OCORRENCIA",
      body: "Observação administrativa",
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["ativa", "ACTIVE", false, null],
    ["suspensa", "SUSPENDED", false, null],
    ["cancelada", "CANCELLED", false, null],
    ["pré-matrícula", "ACTIVE", true, null],
    ["aluno excluído", "ACTIVE", false, now],
  ])("rejeita POST legado sem tipo para matrícula %s", async (_label, status, isPreEnrollment, deletedAt) => {
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue(
      ownedEnrollment(status, { isPreEnrollment, deletedAt }) as never,
    );
    const response = await post({ body: "Mensagem sem tipo" });
    expect(response.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.enrollmentHistoryEntry.create).not.toHaveBeenCalled();
  });
  it.each([
    ["suspensa", ownedEnrollment("SUSPENDED")],
    ["pré-matrícula", ownedEnrollment("ACTIVE", { isPreEnrollment: true })],
    ["aluno excluído", ownedEnrollment("ACTIVE", { deletedAt: now })],
  ])("rejeita registro estruturado para matrícula %s", async (_label, enrollment) => {
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue(enrollment as never);
    const response = await post({
      body: "Mensagem preparada",
      contactType: "CONTATO_REALIZADO",
      requestId,
      revision,
    });
    expect(response.status).toBe(404);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.enrollmentHistoryEntry.create).not.toHaveBeenCalled();
  });
  it("rejeita campos de contato em uma observação administrativa", async () => {
    const response = await post({
      body: "Observação administrativa",
      kind: "OCORRENCIA",
      contactType: "CONTATO_REALIZADO",
    });
    expect(response.status).toBe(400);
    expect(prisma.enrollmentHistoryEntry.create).not.toHaveBeenCalled();
  });
  it("revalida a ocorrência dentro da transação se o vínculo mudou", async () => {
    vi.mocked(prisma.enrollment.findFirst)
      .mockResolvedValueOnce(ownedEnrollment("CANCELLED") as never)
      .mockResolvedValueOnce(null);
    const response = await post({ body: "Observação administrativa", kind: "OCORRENCIA" });
    expect(response.status).toBe(409);
    expect(prisma.enrollmentHistoryEntry.create).not.toHaveBeenCalled();
  });
  it("não grava ocorrência se o professor perdeu o acesso antes da transação", async () => {
    vi.mocked(prisma.teacher.findFirst)
      .mockResolvedValueOnce({ id: "professor-1" } as never)
      .mockResolvedValueOnce(null);
    const response = await post({ body: "Observação administrativa", kind: "OCORRENCIA" });
    expect(response.status).toBe(409);
    expect(prisma.enrollmentHistoryEntry.create).not.toHaveBeenCalled();
  });
  it("revalida a elegibilidade antes da escrita se a matrícula foi cancelada durante o formulário", async () => {
    const active = {
      id: "matricula-1",
      status: "ACTIVE",
      isPreEnrollment: false,
      updatedAt: now,
      student: { updatedAt: now, deletedAt: null },
      classGroup: {
        updatedAt: now,
        course: { updatedAt: now },
        cycle: { updatedAt: now },
        poloLocation: null,
      },
    };
    vi.mocked(prisma.enrollment.findFirst)
      .mockResolvedValueOnce(active as never)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.enrollmentHistoryEntry.findUnique).mockResolvedValue(null);
    const response = await post({
      body: "Mensagem preparada",
      contactType: "CONTATO_REALIZADO",
      factDate: "2026-10-29",
      channel: "WhatsApp",
      result: "AGUARDANDO_RESPOSTA",
      requestId,
      revision,
    });
    expect(response.status).toBe(409);
    expect(prisma.enrollmentHistoryEntry.create).not.toHaveBeenCalled();
  });
  it("não transforma observação em contato por campos enviados pelo formulário", async () => {
    const recordBody = buildAdministrativeRecord({
      type: "OBSERVACAO",
      text: "Nota interna",
      authorName: "Professor Teste",
    });
    vi.mocked(prisma.enrollmentHistoryEntry.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.enrollmentHistoryEntry.create).mockResolvedValue({
      id: requestId,
      kind: "BUSCA_ATIVA",
      body: recordBody,
      createdAt: now,
      author: { name: "Professor Teste" },
    } as never);
    const response = await post({
      body: "Nota interna",
      contactType: "OBSERVACAO",
      factDate: "2026-10-29",
      channel: "WhatsApp",
      result: "AGUARDANDO_RESPOSTA",
      revision,
      requestId,
    });
    expect(response.status).toBe(201);
    expect(vi.mocked(prisma.enrollmentHistoryEntry.create).mock.calls[0][0].data.body).toBe(
      recordBody,
    );
    expect(recordBody).not.toContain("Resultado informado:");
    expect(recordBody).not.toContain("Data do fato:");
  });
});
