import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import {
  buildCertificateSignoffListPdf,
  certificateSignoffTitleLines,
  sortCertificateSignoffNames,
} from "@/lib/certificate-signoff-list-pdf";
import { classGroupCertificateEnrollmentWhere } from "@/lib/certificate-zip-enrollment";

describe("listagem de assinatura do certificado", () => {
  it("monta o título com ciclo, turma e curso", () => {
    expect(
      certificateSignoffTitleLines({
        courseName: "Informática",
        teacherName: "Maria Silva",
        cycle: 4,
        year: 2026,
        location: "Padre Eutíquio",
        daysOfWeek: ["SEG", "QUA"],
        startTime: "08:00",
        endTime: "10:00",
      }),
    ).toEqual([
      "Ciclo 4/2026",
      "Turma: Padre Eutíquio · seg e qua · 08:00–10:00",
      "Curso: Informática",
      "Professor: Maria Silva",
    ]);
  });

  it("gera um PDF", async () => {
    const bytes = await buildCertificateSignoffListPdf({
      group: {
        courseName: "Informática",
        teacherName: "Maria Silva",
        cycle: 4,
        year: 2026,
        location: "Padre Eutíquio",
        daysOfWeek: ["SEG"],
        startTime: "08:00",
        endTime: "10:00",
      },
      students: [{ name: "Bruno" }, { name: "Ana" }],
    });
    expect(Buffer.from(bytes.subarray(0, 5)).toString("utf8")).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("inclui a logo baixada quando os bytes são PNG", async () => {
    const png = PNG.sync.write(new PNG({ width: 8, height: 4, fill: true }));
    const bytes = await buildCertificateSignoffListPdf({
      group: {
        courseName: "Informática",
        teacherName: "Maria Silva",
        cycle: 4,
        year: 2026,
        location: null,
        daysOfWeek: ["SEG"],
        startTime: "08:00",
        endTime: "10:00",
      },
      students: [{ name: "Ana" }],
      logoBytes: png,
    });
    expect(Buffer.from(bytes.subarray(0, 5)).toString("utf8")).toBe("%PDF-");
  });

  it("ordena os nomes em português", () => {
    expect(sortCertificateSignoffNames(["Ícaro", "ana", "Bruno"])).toEqual(["ana", "Bruno", "Ícaro"]);
  });
});

describe("filtro do ZIP de certificados da turma", () => {
  it("inclui todo aluno habilitado, inclusive pré-matrícula, e exclui cancelados", () => {
    expect(classGroupCertificateEnrollmentWhere("turma-1")).toEqual({
      classGroupId: "turma-1",
      certificateEligible: true,
      status: { notIn: ["CANCELLED", "CANCELED"] },
    });
  });
});
