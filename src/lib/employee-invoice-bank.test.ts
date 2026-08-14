import { describe, expect, it } from "vitest";

import { compareEmployeeBankData } from "@/lib/employee-invoice-bank";

const employee = {
  bankName: "Nubank",
  bankAgency: "0001",
  bankAccount: "117011346-5",
  bankAccountType: "CORRENTE" as const,
  pixKey: "64.798.644/0001-50",
  pixKeyType: "CNPJ" as const,
  meiCnpj: "64.798.644/0001-50",
};

describe("compareEmployeeBankData", () => {
  it("não bloqueia quando o PDF não tem dados bancários", () => {
    const check = compareEmployeeBankData(employee, {});
    expect(check.hasExtractedBankData).toBe(false);
    expect(check.mismatches).toEqual([]);
  });

  it("considera iguais após normalizar dígitos e nome", () => {
    const check = compareEmployeeBankData(employee, {
      bankName: "Nubank - 0260",
      bankAgency: "1",
      bankAccount: "1170113465",
      pixKey: "64798644000150",
      prestadorCnpj: "64798644000150",
    });
    expect(check.hasExtractedBankData).toBe(true);
    expect(check.mismatches).toEqual([]);
  });

  it("lista divergências quando o PIX e a conta diferem", () => {
    const check = compareEmployeeBankData(employee, {
      bankName: "Itaú",
      bankAgency: "0001",
      bankAccount: "99999-1",
      pixKey: "email@teste.com",
    });
    expect(check.mismatches.some((m) => /Banco/i.test(m))).toBe(true);
    expect(check.mismatches.some((m) => /Conta/i.test(m))).toBe(true);
    expect(check.mismatches.some((m) => /PIX/i.test(m))).toBe(true);
    expect(check.mismatches.some((m) => /Agência/i.test(m))).toBe(false);
  });
});
