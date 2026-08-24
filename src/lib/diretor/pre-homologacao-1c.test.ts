import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  countServedUniqueStudents,
  reconcileConfirmedNonStart,
} from "@/lib/diretor/metrics/attendance-formulas";
import { friendlyDataStamp, formatDataConsideredUntil, formatInstantPtBr } from "@/lib/diretor/ui-labels";

function src(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("pre-homologação 1C — atendidos e carimbo", () => {
  it("Visão Geral, Acadêmico e Impacto Social usam exclusivamente countServedUniqueStudents", () => {
    expect(src("src/lib/diretor/facts/academic.ts")).toContain("countServedUniqueStudents");
    expect(src("src/lib/diretor/metrics/academic.ts")).toContain("countServedUniqueStudents");
    expect(src("src/lib/diretor/metrics/social.ts")).toContain("countServedUniqueStudents");
    expect(src("src/lib/diretor/metrics/overview.ts")).toContain('metricCard("ben.served_unique", acad.servedUnique');
    expect(src("src/lib/diretor/metrics/social.ts")).toContain('metricCard("ben.served_unique"');
    expect(src("src/lib/diretor/metrics/overview.ts")).not.toMatch(/COUNT DISTINCT/);
  });

  it("a mesma função canônica devolve o mesmo total para os mesmos fatos", () => {
    const asOf = new Date("2026-08-24T12:30:00.000Z");
    const enrollments = [
      { id: "e1", studentId: "p1", classGroupId: "cg1", enrolledAt: new Date("2026-08-01"), enrollmentConfirmedAt: null },
      { id: "e2", studentId: "p1", classGroupId: "cg1", enrolledAt: new Date("2026-08-01"), enrollmentConfirmedAt: null },
      { id: "e3", studentId: "p2", classGroupId: "cg1", enrolledAt: new Date("2026-08-01"), enrollmentConfirmedAt: null },
    ];
    const sessions = [
      {
        id: "s1",
        classGroupId: "cg1",
        status: "LIBERADA" as const,
        sessionDate: new Date("2026-08-10T12:00:00.000Z"),
        startTime: "09:00",
      },
    ];
    const att = new Map([
      ["e1", new Map([["s1", { classSessionId: "s1", present: true, absenceJustification: null }]])],
      ["e3", new Map([["s1", { classSessionId: "s1", present: true, absenceJustification: null }]])],
    ]);
    const overview = countServedUniqueStudents(enrollments, sessions, att, asOf);
    const academic = countServedUniqueStudents(enrollments, sessions, att, asOf);
    const social = countServedUniqueStudents(enrollments, sessions, att, asOf);
    expect(overview).toBe(2);
    expect(overview).toBe(academic);
    expect(academic).toBe(social);
  });

  it("não início reconcilia matrículas confirmadas sem misturar atendidos", () => {
    const confirmed = 1739;
    const startedAmongConfirmed = 930;
    const r = reconcileConfirmedNonStart(confirmed, startedAmongConfirmed);
    expect(r.notStarted).toBe(confirmed - startedAmongConfirmed);
    expect(r.rate).toBe(Math.round((r.notStarted / confirmed) * 1000) / 10);
    const ui = src("src/app/(protected)/diretor/academico/page.tsx");
    expect(ui).toContain("Reconciliação do não início (matrículas confirmadas)");
    expect(ui).toContain("Iniciaram entre os confirmados");
  });

  it("carimbo executivo usa fuso institucional e não expõe nome técnico", () => {
    const iso = "2026-08-24T12:30:00.000-03:00";
    expect(formatInstantPtBr(iso)).toMatch(/24\/08\/2026, às \d{2}:\d{2}/);
    expect(formatDataConsideredUntil(iso)).toMatch(/^Dados considerados até 24\/08\/2026/);
    expect(friendlyDataStamp(iso, iso)).toMatch(/^Atualizado em 24\/08\/2026/);
    expect(friendlyDataStamp(iso, "2026-08-24T18:00:00.000Z")).toMatch(/^Dados considerados até/);
    expect(src("src/components/diretor/DirectorDataStamp.tsx")).toContain("friendlyDataStamp");
  });
});
