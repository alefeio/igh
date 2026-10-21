import { describe, expect, it } from "vitest";

import {
  buildPublicTeacherEvaluationRanking,
  enrollmentNeedsTeacherEvaluationPrompt,
  parseTeacherClassEvaluationBody,
  teacherEvaluationAuthorLabel,
  teacherClassEvaluationListWhere,
} from "@/lib/teacher-class-evaluation";

describe("avaliação do professor", () => {
  it("aceita nota, comentário e envio anônimo", () => {
    const parsed = parseTeacherClassEvaluationBody({
      rating: 4,
      comment: "  Explica com clareza.  ",
      anonymous: true,
    });
    expect(parsed).toEqual({
      ok: true,
      value: { rating: 4, comment: "Explica com clareza.", anonymous: true },
    });
  });

  it("recusa comentário em branco", () => {
    const parsed = parseTeacherClassEvaluationBody({ rating: "5", comment: "   ", anonymous: false });
    expect(parsed.ok).toBe(false);
    expect(parseTeacherClassEvaluationBody({ rating: 5, anonymous: false }).ok).toBe(false);
  });

  it("recusa nota fora de 1 a 5", () => {
    expect(parseTeacherClassEvaluationBody({ rating: 0, anonymous: false }).ok).toBe(false);
    expect(parseTeacherClassEvaluationBody({ rating: 6, anonymous: true }).ok).toBe(false);
  });

  it("abre o aviso só com presença registrada, sem avaliação e sem dispensa", () => {
    expect(
      enrollmentNeedsTeacherEvaluationPrompt({
        hasEvaluation: false,
        reminderDismissedAt: null,
        hasRecordedPresence: true,
      }),
    ).toBe(true);
    expect(
      enrollmentNeedsTeacherEvaluationPrompt({
        hasEvaluation: false,
        reminderDismissedAt: null,
        hasRecordedPresence: false,
      }),
    ).toBe(false);
    expect(
      enrollmentNeedsTeacherEvaluationPrompt({
        hasEvaluation: true,
        reminderDismissedAt: null,
        hasRecordedPresence: true,
      }),
    ).toBe(false);
    expect(
      enrollmentNeedsTeacherEvaluationPrompt({
        hasEvaluation: false,
        reminderDismissedAt: "2026-10-19T12:00:00.000Z",
        hasRecordedPresence: true,
      }),
    ).toBe(false);
  });

  it("esconde o nome do professor e mostra para a coordenação", () => {
    expect(teacherEvaluationAuthorLabel(true, "Maria Souza")).toBe("Anônimo");
    expect(teacherEvaluationAuthorLabel(true, "Maria Souza", { revealIdentity: true })).toBe("Maria Souza");
    expect(teacherEvaluationAuthorLabel(false, " Maria Souza ")).toBe("Maria Souza");
    expect(teacherEvaluationAuthorLabel(false, "  ")).toBe("Aluno");
  });

  it("esconde avaliação anônima de quem não é a coordenação", () => {
    expect(teacherClassEvaluationListWhere("teacher-1")).toEqual({
      teacherId: "teacher-1",
      anonymous: false,
    });
    expect(teacherClassEvaluationListWhere(undefined, { includeAnonymous: true })).toEqual({});
  });
});

describe("ranking público dos professores", () => {
  it("ordena pela média e guarda a avaliação pública mais recente", () => {
    const ranking = buildPublicTeacherEvaluationRanking([
      {
        teacherId: "a",
        teacherName: "Ana",
        rating: 5,
        comment: "Antiga",
        at: "2026-10-01T12:00:00.000Z",
        authorLabel: "João",
        courseName: "Informática",
        classLabel: "seg · 19:00–21:00",
      },
      {
        teacherId: "b",
        teacherName: "Bruno",
        rating: 4,
        comment: "Boa aula",
        at: "2026-10-02T12:00:00.000Z",
        authorLabel: "Maria",
        courseName: "Inglês",
        classLabel: "",
      },
      {
        teacherId: "a",
        teacherName: "Ana",
        rating: 3,
        comment: "Recente",
        at: "2026-10-20T12:00:00.000Z",
        authorLabel: "Paula",
        courseName: "Informática",
        classLabel: "qua · 19:00–21:00",
      },
    ]);
    expect(ranking.map((row) => row.teacherName)).toEqual(["Ana", "Bruno"]);
    expect(ranking[0]).toMatchObject({
      averageRating: 4,
      evaluationCount: 2,
      latest: { rating: 3, comment: "Recente", authorLabel: "Paula" },
    });
  });
});
