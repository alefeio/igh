import { describe, expect, it } from "vitest";

import {
  buildEnrollmentVacancyRows,
  classGroupLocationLabel,
  classGroupTeacherLabel,
  summarizeVacanciesByCourse,
} from "@/lib/enrollment-vacancy-report";

describe("enrollment vacancy report", () => {
  it("monta local com polo e unidade", () => {
    expect(
      classGroupLocationLabel({
        id: "1",
        startDate: "2026-08-18",
        daysOfWeek: ["TER", "QUI"],
        startTime: "09:00",
        endTime: "10:15",
        course: { id: "c1", name: "Informática" },
        poloLocation: { id: "l1", name: "Centro", polo: { id: "p1", name: "Belém" } },
      }),
    ).toBe("Belém · Centro");
  });

  it("lista professores sem repetir", () => {
    expect(
      classGroupTeacherLabel({
        id: "1",
        startDate: "2026-08-18",
        daysOfWeek: [],
        startTime: "09:00",
        endTime: "10:15",
        course: { id: "c1", name: "Informática" },
        teacher: { name: "Ana" },
        teachers: [{ name: "Ana" }, { name: "Bruno" }],
      }),
    ).toBe("Ana, Bruno");
  });

  it("gera linhas com professor, matriculados e formados", () => {
    const rows = buildEnrollmentVacancyRows(
      [
        [
          "c1",
          {
            courseName: "Informática",
            turmas: [
              {
                classGroup: {
                  id: "t1",
                  startDate: "2026-08-18",
                  daysOfWeek: ["TER", "QUI"],
                  startTime: "09:00",
                  endTime: "10:15",
                  capacity: 20,
                  location: "Centro",
                  teacher: { name: "Ana" },
                  course: { id: "c1", name: "Informática" },
                },
                count: 12,
                active: 10,
                cancelled: 1,
                completed: 2,
              },
            ],
          },
        ],
      ],
      () => "18/08/2026",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      courseName: "Informática",
      startDate: "18/08/2026",
      schedule: "09:00-10:15",
      turmaLabel: "Turma 01",
      teacher: "Ana",
      enrolled: 12,
      graduated: 2,
      capacity: 20,
    });
    expect(summarizeVacanciesByCourse(rows)[0].graduated).toBe(2);
  });
});
