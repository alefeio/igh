import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getSessionUserFromCookie: vi.fn() }));
vi.mock("@/lib/class-group-teachers", () => ({
  classGroupTeacherAccessWhere: () => ({ teacherId: "professor-1" }),
}));
vi.mock("@/lib/enrollment-attendance-summary", () => ({
  getEnrollmentAttendanceSummaries: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    teacher: { findFirst: vi.fn() },
    classGroup: { findFirst: vi.fn(), findMany: vi.fn() },
    enrollment: { findMany: vi.fn() },
  },
}));

import { getSessionUserFromCookie } from "@/lib/auth";
import { buildAdministrativeRecord } from "@/lib/busca-ativa";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const auth = vi.mocked(getSessionUserFromCookie);
const teacher = vi.mocked(prisma.teacher.findFirst);
const group = vi.mocked(prisma.classGroup.findFirst);
const enrollments = vi.mocked(prisma.enrollment.findMany);

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ id: "usuario-1", name: "Professor Teste", role: "TEACHER" } as never);
  teacher.mockResolvedValue({ id: "professor-1" } as never);
});

describe("API de busca ativa do professor", () => {
  it("nega consulta sem sessão antes de acessar dados", async () => {
    auth.mockResolvedValue(null);
    const response = await GET(
      new Request("http://local/api/teacher/busca-ativa?classGroupId=alheia"),
    );
    expect(response.status).toBe(401);
    expect(group).not.toHaveBeenCalled();
    expect(enrollments).not.toHaveBeenCalled();
  });
  it("não escolhe uma turma implicitamente quando falta o ID", async () => {
    const response = await GET(new Request("http://local/api/teacher/busca-ativa"));
    expect(response.status).toBe(400);
    expect(group).not.toHaveBeenCalled();
    expect(enrollments).not.toHaveBeenCalled();
  });
  it("nega turma fora do vínculo do professor antes de listar matrículas", async () => {
    group.mockResolvedValue(null);
    const response = await GET(
      new Request(
        "http://local/api/teacher/busca-ativa?classGroupId=alheia&enrollmentId=matricula-alheia",
      ),
    );
    expect(response.status).toBe(404);
    expect(group).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "alheia", teacherId: "professor-1" } }),
    );
    expect(enrollments).not.toHaveBeenCalled();
  });
  it("vincula a matrícula pedida à turma autorizada", async () => {
    group.mockResolvedValue({ id: "turma-1" } as never);
    enrollments.mockResolvedValue([]);
    const response = await GET(
      new Request(
        "http://local/api/teacher/busca-ativa?classGroupId=turma-1&enrollmentId=matricula-alheia",
      ),
    );
    expect(response.status).toBe(404);
    expect(enrollments).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ classGroupId: "turma-1", id: "matricula-alheia" }),
      }),
    );
  });
  it("lista ativos e cancelados da turma, mas só libera contato para ativos elegíveis", async () => {
    const now = new Date("2026-10-29T12:00:00.000Z");
    group.mockResolvedValue({
      id: "turma-1",
      updatedAt: now,
      startTime: "14h",
      endTime: "15h",
      daysOfWeek: ["QUA"],
      location: "Sede",
      whatsappGroupUrl: null,
      course: { id: "curso-1", name: "Curso Exemplo", updatedAt: now },
      cycle: { cycle: 1, year: 2026, updatedAt: now },
      poloLocation: null,
    } as never);
    const rows = ["ACTIVE", "CANCELLED", "ACTIVE", "CANCELLED", "ACTIVE", "SUSPENDED", "ACTIVE", "ACTIVE"].map((status, index) => ({
        id: `matricula-${index}`,
        status,
        isPreEnrollment: index === 6,
        updatedAt: now,
        student: {
          id: `aluno-${index}`,
          name: `Aluno ${index}`,
          phone: null,
          updatedAt: now,
          deletedAt: index === 7 ? now : null,
        },
        _count: { historyEntries: 0 },
        historyEntries: [],
      }));
    enrollments.mockResolvedValueOnce(rows as never);
    const response = await GET(
      new Request("http://local/api/teacher/busca-ativa?classGroupId=turma-1"),
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(
      json.data.enrollments.map((item: { enrollmentId: string }) => item.enrollmentId),
    ).toEqual(["matricula-0", "matricula-1", "matricula-2", "matricula-3", "matricula-4", "matricula-5", "matricula-6", "matricula-7"]);
    expect(json.data.enrollments.map((item: { contactEligible: boolean }) => item.contactEligible)).toEqual([
      true, false, true, false, true, false, false, false,
    ]);
    expect(enrollments).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          classGroupId: "turma-1",
          status: { in: ["ACTIVE", "SUSPENDED", "CANCELLED"] },
        }),
      }),
    );
    enrollments.mockResolvedValueOnce([rows[1]] as never);
    const forced = await GET(
      new Request(
        "http://local/api/teacher/busca-ativa?classGroupId=turma-1&enrollmentId=matricula-1",
      ),
    );
    expect(forced.status).toBe(200);
    const forcedJson = await forced.json();
    expect(forcedJson.data.enrollments[0]).toEqual(
      expect.objectContaining({ enrollmentId: "matricula-1", contactEligible: false }),
    );
  });
  it("lê o contato confirmado pelo histórico existente e ignora texto livre na classificação", async () => {
    const now = new Date("2026-10-29T12:00:00.000Z");
    const saved = buildAdministrativeRecord({
      type: "CONTATO_REALIZADO",
      text: "Mensagem final",
      factDate: "2026-10-28",
      result: "AGUARDANDO_RESPOSTA",
      channel: "WhatsApp",
      authorName: "Professor Teste",
    });
    group.mockResolvedValue({
      id: "turma-1",
      updatedAt: now,
      startTime: "14h",
      endTime: "15h",
      daysOfWeek: ["QUA"],
      location: "Sede",
      whatsappGroupUrl: null,
      course: { id: "curso-1", name: "Informática Básica", updatedAt: now },
      cycle: { cycle: 1, year: 2026, updatedAt: now },
      poloLocation: null,
    } as never);
    enrollments.mockResolvedValue([
      {
        id: "matricula-1",
        status: "ACTIVE",
        updatedAt: now,
        student: { id: "aluno-1", name: "Ana", phone: null, updatedAt: now },
        _count: { historyEntries: 2 },
        historyEntries: [
          {
            id: "livre",
            kind: "BUSCA_ATIVA",
            body: "Texto livre: sem resposta",
            createdAt: now,
            author: { name: "Professor Teste" },
          },
          {
            id: "confirmado",
            kind: "BUSCA_ATIVA",
            body: saved,
            createdAt: new Date("2026-10-28T12:00:00.000Z"),
            author: { name: "Professor Teste" },
          },
        ],
      },
    ] as never);
    const response = await GET(
      new Request("http://local/api/teacher/busca-ativa?classGroupId=turma-1"),
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.enrollments[0].hasBuscaAtiva).toBe(true);
    expect(json.data.enrollments[0].history).toEqual([
      expect.objectContaining({
        id: "confirmado",
        contactType: "CONTATO_REALIZADO",
        result: "AGUARDANDO_RESPOSTA",
        factDate: "2026-10-28",
      }),
    ]);
    expect(enrollments).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          historyEntries: expect.objectContaining({ where: { kind: "BUSCA_ATIVA" } }),
        }),
      }),
    );
  });
});
