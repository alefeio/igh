import { describe, expect, it } from "vitest";

import {
  parseTeacherClassEvaluationBody,
  teacherEvaluationAuthorLabel,
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

  it("permite comentário em branco", () => {
    const parsed = parseTeacherClassEvaluationBody({ rating: "5", comment: "   ", anonymous: false });
    expect(parsed.ok && parsed.value.comment).toBeNull();
  });

  it("recusa nota fora de 1 a 5", () => {
    expect(parseTeacherClassEvaluationBody({ rating: 0, anonymous: false }).ok).toBe(false);
    expect(parseTeacherClassEvaluationBody({ rating: 6, anonymous: true }).ok).toBe(false);
  });

  it("esconde o nome do professor e mostra para a coordenação", () => {
    expect(teacherEvaluationAuthorLabel(true, "Maria Souza")).toBe("Anônimo");
    expect(teacherEvaluationAuthorLabel(true, "Maria Souza", { revealIdentity: true })).toBe("Maria Souza");
    expect(teacherEvaluationAuthorLabel(false, " Maria Souza ")).toBe("Maria Souza");
    expect(teacherEvaluationAuthorLabel(false, "  ")).toBe("Aluno");
  });
});
