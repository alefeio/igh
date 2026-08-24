import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "path";

describe("regras Fase 1C", () => {
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

  it("Guia diferencia idade em aberto e vencimento", () => {
    const t = readFileSync(path.join(process.cwd(), "src/app/api/diretor/guide/route.ts"), "utf8");
    expect(t).toMatch(/idadeEmAberto/);
    expect(t).toMatch(/dueDate/);
    expect(t.toLowerCase()).not.toMatch(/inadimplência de aluno/);
  });
});
