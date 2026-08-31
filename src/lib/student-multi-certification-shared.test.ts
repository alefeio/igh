import { describe, expect, it } from "vitest";

import {
  aggregateCertifiedStudents,
  assignMultiCertDisplayNames,
  computeStudentMultiCertProgress,
  selectForFeaturedShowcase,
  selectForFullShowcase,
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

  it("seleciona somente alunos com 3+ para vitrine em destaque", () => {
    const sorted = sortMultiCertStudents(
      Array.from({ length: 10 }, (_, i) => ({
        studentId: `s${i}`,
        studentName: `Aluno ${i}`,
        certificationCount: i < 3 ? 3 : i < 8 ? 2 : 1,
        courseIds: Array.from({ length: i < 3 ? 3 : i < 8 ? 2 : 1 }, (_, j) => `c${i}-${j}`),
        lastCompletedAt: new Date(`2026-01-${String((i % 28) + 1).padStart(2, "0")}`),
      })),
    );

    const { selected, totalEligible, hiddenCount } = selectForFeaturedShowcase(sorted);
    expect(totalEligible).toBe(3);
    expect(selected).toHaveLength(3);
    expect(selected.every((s) => s.certificationCount >= 3)).toBe(true);
    expect(hiddenCount).toBe(0);
  });

  it("lista mural completo a partir de 2 certificações", () => {
    const sorted = sortMultiCertStudents([
      {
        studentId: "a",
        studentName: "A",
        certificationCount: 3,
        courseIds: ["c1", "c2", "c3"],
        lastCompletedAt: null,
      },
      {
        studentId: "b",
        studentName: "B",
        certificationCount: 2,
        courseIds: ["c1", "c2"],
        lastCompletedAt: null,
      },
      {
        studentId: "c",
        studentName: "C",
        certificationCount: 1,
        courseIds: ["c1"],
        lastCompletedAt: null,
      },
    ]);

    const { selected, totalEligible } = selectForFullShowcase(sorted);
    expect(totalEligible).toBe(2);
    expect(selected.map((s) => s.studentId)).toEqual(["a", "b"]);
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
    expect(computeStudentMultiCertProgress(0, "João").coursesNeededForFeatured).toBe(3);
    expect(computeStudentMultiCertProgress(1, "João").coursesNeededForMural).toBe(1);
    expect(computeStudentMultiCertProgress(1, "João").isOnMural).toBe(false);

    const onMural = computeStudentMultiCertProgress(2, "João Silva");
    expect(onMural.isOnMural).toBe(true);
    expect(onMural.isOnFeaturedShowcase).toBe(false);
    expect(onMural.tier).toBe("silver");
    expect(onMural.coursesNeededForFeatured).toBe(1);

    const featured = computeStudentMultiCertProgress(3, "João Silva");
    expect(featured.isOnFeaturedShowcase).toBe(true);
    expect(featured.coursesNeededForNextTier).toBe(1);

    const top = computeStudentMultiCertProgress(4, "João Silva");
    expect(top.tier).toBe("platinum");
    expect(top.coursesNeededForNextTier).toBeNull();
  });
});
