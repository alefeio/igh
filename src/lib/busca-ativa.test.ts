import { describe, expect, it } from "vitest";
import {
  MESSAGE_TEMPLATES,
  buildAdministrativeRecord,
  contextVariables,
  filterBuscaAtivaStudents,
  formatCalendarDate,
  isBuscaAtivaEligible,
  messageEvidenceWarning,
  parseAdministrativeRecord,
  renderMessage,
  whatsappMessageUrl,
  type MessageContext,
} from "./busca-ativa";

const base: MessageContext = {
  classGroupId: "turma-1",
  courseId: "curso-a",
  courseName: "Informática Básica",
  turmaNome: "Informática Básica 02",
  daysOfWeek: ["QUA", "SEX"],
  startTime: "16h30",
  endTime: "17h45",
  location: "Sede",
  unidadeNome: "Sede",
  whatsappGroupUrl: "https://chat.whatsapp.com/grupo2",
  professorNome: "Professor Teste",
  revision: "1",
  enrollmentId: "matricula-a",
  studentId: "aluno-a",
  studentName: "Ana Teste",
  studentPhone: "+5591999999999",
};

const model = (id: string) => {
  const found = MESSAGE_TEMPLATES.find((t) => t.id === id);
  if (!found) throw new Error(`Modelo ausente: ${id}`);
  return found;
};

describe("busca ativa", () => {
  it("admite apenas matrícula ACTIVE efetivada e com aluno disponível", () => {
    expect(
      isBuscaAtivaEligible({ status: "ACTIVE", isPreEnrollment: false, studentDeletedAt: null }),
    ).toBe(true);
    for (const status of [
      "CANCELLED",
      "SUSPENDED",
      "COMPLETED",
      "INACTIVE",
      "TRANSFERRED",
      "UNKNOWN",
    ]) {
      expect(isBuscaAtivaEligible({ status })).toBe(false);
    }
    expect(isBuscaAtivaEligible({ status: "ACTIVE", isPreEnrollment: true })).toBe(false);
    expect(isBuscaAtivaEligible({ status: "ACTIVE", studentDeletedAt: new Date() })).toBe(false);
  });
  it("mostra toda a turma na busca e mantém a elegibilidade separada", () => {
    const items: MessageContext[] = [
      { ...base, enrollmentId: "m1", studentName: "Aluno A", status: "ACTIVE" },
      { ...base, enrollmentId: "m2", studentName: "Aluno Cancelado 1", status: "CANCELLED" },
      {
        ...base,
        enrollmentId: "m3",
        studentName: "Aluno B",
        status: "ACTIVE",
        attendanceUnjustifiedAbsenceCount: 2,
      },
      { ...base, enrollmentId: "m4", studentName: "Aluno Cancelado 2", status: "CANCELLED" },
      { ...base, enrollmentId: "m5", studentName: "Aluno C", status: "ACTIVE" },
    ];
    expect(filterBuscaAtivaStudents(items, "", "").map((item) => item.enrollmentId)).toEqual([
      "m1", "m2", "m3", "m4", "m5",
    ]);
    expect(filterBuscaAtivaStudents(items, "cancelado", "").map((item) => item.enrollmentId)).toEqual(["m2", "m4"]);
    expect(filterBuscaAtivaStudents(items, "", "faltas").map((item) => item.enrollmentId)).toEqual([
      "m3",
    ]);
  });
  it("usa os dados da matrícula e turma selecionadas, mesmo com o mesmo curso", () => {
    const a = renderMessage(model("ausencia-acolhedora"), contextVariables(base));
    const b = renderMessage(
      model("ausencia-acolhedora"),
      contextVariables({
        ...base,
        classGroupId: "turma-2",
        enrollmentId: "matricula-b",
        studentId: "aluno-b",
        studentName: "Bruno Exemplo",
        turmaNome: "Informática Básica 01",
        startTime: "14h",
        endTime: "15h15",
        unidadeNome: "Outra unidade",
      }),
    );
    expect(a.text).toContain("Ana");
    expect(a.text).toContain("16h30 às 17h45");
    expect(a.text).toContain("Informática Básica 02");
    expect(b.text).toContain("Bruno");
    expect(b.text).toContain("14h às 15h15");
    expect(b.text).not.toContain("Ana");
  });
  it("impede variável obrigatória ausente e chave desconhecida", () => {
    expect(renderMessage(model("ausencia-direta"), contextVariables(base)).missing).toContain(
      "dataAusencia",
    );
    expect(
      renderMessage({ ...model("ausencia-direta"), body: "{{campoInexistente}}" }, {}).unknown,
    ).toEqual(["campoInexistente"]);
  });
  it("mantém emojis, quebras, asteriscos e chaves literais de valores", () => {
    const values = { ...contextVariables(base), alunoPrimeiroNome: "Ana {{literal}} 😊" };
    const output = renderMessage(model("ausencia-acolhedora"), values);
    expect(output.text).toContain("Ana {{literal}} 😊");
    expect(output.text).toContain("\n\n");
    expect(output.text).toContain("*Informática Básica*");
  });
  it("não desloca datas sem horário e não depende de datas históricas", () => {
    expect(formatCalendarDate("2026-10-29")).toBe("29/10/2026");
    expect(formatCalendarDate("2026-02-30")).toBe("");
    const output = renderMessage(model("lembrete-aula"), {
      ...contextVariables(base),
      dataAula: "2026-10-29",
    });
    expect(output.text).toContain("29/10/2026");
    expect(output.text).not.toContain("21/10/2026");
  });
  it("mantém mensagens de turma sem dados individuais e modelos internos fora do WhatsApp", () => {
    for (const template of MESSAGE_TEMPLATES.filter((t) => t.audience === "turma")) {
      expect(template.body).not.toMatch(/{{\s*aluno|{{\s*retornoAluno|{{\s*resultadoContato/);
    }
    expect(
      MESSAGE_TEMPLATES.filter((t) => t.audience === "interno").every(
        (t) => t.audience !== "aluno",
      ),
    ).toBe(true);
  });
  it("não duplica DDI e rejeita número ausente ou inválido", () => {
    expect(
      whatsappMessageUrl("+55 (91) 99999-9999", "Olá 😊")?.startsWith(
        "https://wa.me/5591999999999?text=",
      ),
    ).toBe(true);
    expect(
      whatsappMessageUrl("(91) 99999-9999", "Olá")?.startsWith("https://wa.me/5591999999999?"),
    ).toBe(true);
    expect(whatsappMessageUrl("123", "Olá")).toBeNull();
  });
  it("não classifica 0/0 nem frequência não lançada como ausência comprovada", () => {
    expect(
      messageEvidenceWarning(model("primeira-presenca"), {
        ...base,
        attendancePresentCount: 0,
        attendanceRecordedCount: 0,
        attendanceTotalSessions: 0,
      }),
    ).toContain("não comprova");
    expect(
      messageEvidenceWarning(model("primeira-presenca"), {
        ...base,
        attendancePresentCount: 0,
        attendanceRecordedCount: 0,
        attendanceTotalSessions: 3,
      }),
    ).toContain("não comprova");
    expect(
      messageEvidenceWarning(model("primeira-presenca"), {
        ...base,
        attendancePresentCount: 0,
        attendanceRecordedCount: 3,
        attendanceTotalSessions: 3,
      }),
    ).toBeNull();
  });
  it("lê o último contato pelo texto do histórico existente sem classificar textos livres", () => {
    const saved = buildAdministrativeRecord({
      type: "CONTATO_REALIZADO",
      text: "Mensagem revisada para Ana\nResultado informado: texto literal do aluno",
      factDate: "2026-10-29",
      channel: "WhatsApp",
      result: "AGUARDANDO_RESPOSTA",
      authorName: "Professor Teste",
      templateId: "ausencia-direta",
      templateVersion: 1,
    });
    expect(saved).toContain("Modelo: ausencia-direta (v1)");
    expect(parseAdministrativeRecord(saved)).toEqual({
      contactType: "CONTATO_REALIZADO",
      result: "AGUARDANDO_RESPOSTA",
      factDate: "2026-10-29",
    });
    expect(
      parseAdministrativeRecord(
        "Contato realizado (informado pelo professor)\nResultado informado: Aguardando resposta",
      ),
    ).toBeNull();
    expect(parseAdministrativeRecord("Observação livre sobre busca ativa")).toBeNull();
  });
});
