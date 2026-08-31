import { describe, expect, it } from "vitest";

import {
  aggregateCertifiedStudents,
  assignMultiCertDisplayNames,
  computeStudentMultiCertProgress,
  selectForPublicShowcase,
  sortMultiCertStudents,
  tierFromCount,
} from "./student-multi-certification-shared";

describe("student-multi-certification-shared", () => {
  it("conta cursos distintos por aluno", () => {
    const rows = [
      {
        studentId: "s1",
        studentName: "Ana Silva",
        courseId: "c1",
        completedAt: new Date("2026-01-10"),
      },
      {
        studentId: "s1",
        studentName: "Ana Silva",
        courseId: "c1",
        completedAt: new Date("2026-02-10"),
      },
      {
        studentId: "s1",
        studentName: "Ana Silva",
        courseId: "c2",
        completedAt: new Date("2026-03-10"),
      },
      {
        studentId: "s2",
        studentName: "Bruno Costa",
        courseId: "c3",
        completedAt: new Date("2026-04-10"),
      },
    ];

    const aggregated = aggregateCertifiedStudents(rows);
    const ana = aggregated.find((s) => s.studentId === "s1");
    expect(ana?.certificationCount).toBe(2);
    expect(ana?.lastCompletedAt?.toISOString().slice(0, 10)).toBe("2026-03-10");
  });

  it("ordena por quantidade e data mais recente", () => {
    const sorted = sortMultiCertStudents([
      {
        studentId: "a",
        studentName: "A",
        certificationCount: 2,
        courseIds: ["c1", "c2"],
        lastCompletedAt: new Date("2026-01-01"),
      },
      {
        studentId: "b",
        studentName: "B",
        certificationCount: 3,
        courseIds: ["c1", "c2", "c3"],
        lastCompletedAt: new Date("2025-01-01"),
      },
      {
        studentId: "c",
        studentName: "C",
        certificationCount: 2,
        courseIds: ["c1", "c2"],
        lastCompletedAt: new Date("2026-06-01"),
      },
    ]);

    expect(sorted.map((s) => s.studentId)).toEqual(["b", "c", "a"]);
  });

  it("define faixas visuais por quantidade", () => {
    expect(tierFromCount(2)).toBe("silver");
    expect(tierFromCount(3)).toBe("gold");
    expect(tierFromCount(4)).toBe("platinum");
    expect(tierFromCount(7)).toBe("platinum");
  });

  it("seleciona todos 3+ e limita prata na home", () => {
    const sorted = sortMultiCertStudents(
      Array.from({ length: 30 }, (_, i) => ({
        studentId: `s${i}`,
        studentName: `Aluno ${i}`,
        certificationCount: i < 5 ? 3 : 2,
        courseIds: Array.from({ length: i < 5 ? 3 : 2 }, (_, j) => `c${i}-${j}`),
        lastCompletedAt: new Date(`2026-01-${String((i % 28) + 1).padStart(2, "0")}`),
      })),
    );

    const { selected, totalEligible, hiddenCount } = selectForPublicShowcase(sorted, 2, 24);
    expect(totalEligible).toBe(30);
    expect(selected.filter((s) => s.certificationCount === 3)).toHaveLength(5);
    expect(selected.filter((s) => s.certificationCount === 2)).toHaveLength(24);
    expect(selected).toHaveLength(29);
    expect(hiddenCount).toBe(1);
  });

  it("desambigua nomes abreviados iguais", () => {
    const students = [
      {
        studentId: "1",
        studentName: "Victoria Ferreira",
        certificationCount: 2,
        courseIds: ["a", "b"],
        lastCompletedAt: null,
      },
      {
        studentId: "2",
        studentName: "Vitoria Ferreira",
        certificationCount: 2,
        courseIds: ["c", "d"],
        lastCompletedAt: null,
      },
    ];
    const names = assignMultiCertDisplayNames(students, "public");
    expect(names.get("1")).not.toBe(names.get("2"));
  });

  it("calcula progresso pessoal para incentivo", () => {
    expect(computeStudentMultiCertProgress(0, "João").coursesNeededForMural).toBe(2);
    expect(computeStudentMultiCertProgress(1, "João").coursesNeededForMural).toBe(1);
    expect(computeStudentMultiCertProgress(1, "João").isOnMural).toBe(false);

    const onMural = computeStudentMultiCertProgress(2, "João Silva");
    expect(onMural.isOnMural).toBe(true);
    expect(onMural.tier).toBe("silver");
    expect(onMural.coursesNeededForNextTier).toBe(1);

    const top = computeStudentMultiCertProgress(4, "João Silva");
    expect(top.tier).toBe("platinum");
    expect(top.coursesNeededForNextTier).toBeNull();
  });
});
