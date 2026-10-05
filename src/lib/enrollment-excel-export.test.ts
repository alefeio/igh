import { describe, expect, it } from "vitest";

import {
  groupVacancyRowsByLocation,
  summarizeVacanciesByCourse,
  type EnrollmentVacancyRow,
} from "@/lib/enrollment-vacancy-report";

function sampleRow(partial: Partial<EnrollmentVacancyRow>): EnrollmentVacancyRow {
  return {
    courseName: "Informática",
    startDate: "18/08/2026",
    schedule: "09:00-10:15",
    days: "TER, QUI",
    turmaLabel: "Turma 01",
    location: "Belém · Centro",
    locationKey: "l1",
    locationName: "Centro",
    locationHeader: "Centro — Polo: Belém | Coordenador: Maria",
    poloName: "Belém",
    coordinatorName: "Maria",
    teacher: "Ana",
    enrolled: 12,
    graduated: 4,
    capacity: 20,
    active: 10,
    cancelled: 1,
    occupancyPercent: 60,
    ...partial,
  };
}

describe("enrollment export summaries", () => {
  it("resume matriculados e formados por curso", () => {
    const rows = [
      sampleRow({ enrolled: 12, graduated: 4, capacity: 20 }),
      sampleRow({ turmaLabel: "Turma 02", enrolled: 8, graduated: 2, capacity: 20 }),
    ];
    const summary = summarizeVacanciesByCourse(rows);
    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({
      courseName: "Informática",
      enrolled: 20,
      graduated: 6,
      capacity: 40,
      classes: 2,
    });
  });

  it("agrupa por local para leitura visual", () => {
    const rows = [
      sampleRow({ locationKey: "a", locationName: "Alpha" }),
      sampleRow({ locationKey: "b", locationName: "Beta", turmaLabel: "Turma 02" }),
    ];
    const sections = groupVacancyRowsByLocation(rows);
    expect(sections.map((s) => s.locationName)).toEqual(["Alpha", "Beta"]);
  });
});
