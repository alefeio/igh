import { describe, expect, it } from "vitest";

import { canUseBuscaAtiva, canViewCoordinatorPedagogy } from "@/lib/coordinator/access";

describe("acesso à busca ativa", () => {
  it("libera administrador pedagógico, professor, coordenador e diretor", () => {
    expect(canUseBuscaAtiva("ADMIN")).toBe(true);
    expect(canUseBuscaAtiva("TEACHER")).toBe(true);
    expect(canUseBuscaAtiva("COORDINATOR")).toBe(true);
    expect(canUseBuscaAtiva("DIRECTOR")).toBe(true);
  });

  it("mantém quem já via a coordenação e nega aluno e demais perfis", () => {
    expect(canUseBuscaAtiva("MASTER")).toBe(true);
    expect(canUseBuscaAtiva("GENERAL_ADMIN")).toBe(true);
    expect(canUseBuscaAtiva("STUDENT")).toBe(false);
    expect(canUseBuscaAtiva("POLO_COORDINATOR")).toBe(false);
    expect(canUseBuscaAtiva("SITE_ADMIN")).toBe(false);
    expect(canUseBuscaAtiva("ADMIN_MANAGER")).toBe(false);
    expect(canUseBuscaAtiva(null)).toBe(false);
  });

  it("não abre o painel pedagógico para professor nem administrador pedagógico", () => {
    expect(canViewCoordinatorPedagogy("TEACHER")).toBe(false);
    expect(canViewCoordinatorPedagogy("ADMIN")).toBe(false);
    expect(canViewCoordinatorPedagogy("COORDINATOR")).toBe(true);
  });
});
