import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "path";

describe("regras Fase 1C", () => {
  it("Prisma Client 7 está gerado em src/generated/prisma", () => {
    expect(existsSync(path.join(process.cwd(), "src/generated/prisma/client.ts"))).toBe(true);
  });

  it("engine de alertas não importa prisma nem loaders temáticos", () => {
    const t = readFileSync(path.join(process.cwd(), "src/lib/diretor/alerts/engine.ts"), "utf8");
    expect(t).not.toMatch(/from ["']@\/lib\/prisma/);
    expect(t).not.toMatch(/loadAcademic\(/);
    expect(t).not.toMatch(/loadSocialImpact/);
    expect(t).toMatch(/alertsFromExecutiveFacts/);
  });

  it("prioridades usam fatos e não cinco loaders completos", () => {
    const t = readFileSync(path.join(process.cwd(), "src/app/api/diretor/priorities/route.ts"), "utf8");
    expect(t).toMatch(/loadAcademicExecutiveFacts/);
    expect(t).toMatch(/alertsFromExecutiveFacts/);
    expect(t).not.toMatch(/loadAcademic\(/);
    expect(t).not.toMatch(/loadOffer\(/);
    expect(t).not.toMatch(/loadSocialImpact/);
    expect(t).not.toMatch(/loadFinancial\(/);
    expect(t).not.toMatch(/loadAdministrative\(/);
  });

  it("redirect só DIRECTOR e só com flag true", () => {
    const page = readFileSync(
      path.join(process.cwd(), "src/app/(protected)/dashboard/page.tsx"),
      "utf8",
    );
    expect(page).toMatch(/user\.role === "DIRECTOR"/);
    expect(page).toMatch(/isDirectorDashboardV2Enabled/);
    expect(page).toMatch(/redirect\("\/diretor"\)/);
    const afterDirector = page.slice(page.indexOf('if (user.role === "DIRECTOR")'));
    const masterBlock = page.includes('user.role === "MASTER"')
      ? page.slice(page.indexOf('user.role === "MASTER"'))
      : "";
    expect(masterBlock).not.toMatch(/redirect\("\/diretor"\)/);
    expect(afterDirector).not.toMatch(/redirect\("\/dashboard"\)/);
  });

  it("layout /diretor aceita MASTER sem redirect para dashboard no próprio layout do diretor", () => {
    const t = readFileSync(path.join(process.cwd(), "src/app/(protected)/diretor/layout.tsx"), "utf8");
    expect(t).toMatch(/DIRECTOR/);
    expect(t).toMatch(/MASTER/);
    expect(t).toMatch(/DirectorMasterPreviewBanner/);
    expect(t).toMatch(/redirect\("\/dashboard"\)/);
  });

  it("textos financeiros do Diretor não usam vencido/atraso/a vencer", () => {
    const files = [
      "src/lib/diretor/metrics/financial.ts",
      "src/lib/diretor/metrics/financial-formulas.ts",
      "src/lib/diretor/facts/financial.ts",
      "src/lib/diretor/alerts/engine.ts",
      "src/app/(protected)/diretor/financeiro/page.tsx",
    ];
    for (const rel of files) {
      const t = readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(t.toLowerCase()).not.toMatch(/dias de atraso/);
      expect(t.toLowerCase()).not.toMatch(/a vencer/);
      expect(t.toLowerCase()).not.toMatch(/atrasad/);
      const withoutNegation = t
        .split("\n")
        .filter((l) => !/não|nao/i.test(l))
        .join("\n")
        .toLowerCase();
      expect(withoutNegation).not.toMatch(/vencid/);
      expect(withoutNegation).not.toMatch(/inadimpl/);
    }
  });
});
