import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

vi.mock("server-only", () => ({}));

import { isIghDonationTemplate, renderIghDonationTermPdf } from "@/lib/admin/donation-term-igh-pdf";

describe("termo IGH", () => {
  it("reconhece o modelo pelo título", () => {
    expect(isIghDonationTemplate("Termo de doação de equipamentos (IGH)")).toBe(true);
    expect(isIghDonationTemplate("Termo de doação de equipamentos")).toBe(false);
  });

  it("gera PDF de duas páginas no layout IGH", async () => {
    const bytes = await renderIghDonationTermPdf({
      donor: {
        name: "INSTITUTO GUSTAVO HESSEL",
        document: "08.633.366/0001-00",
        address: "Travessa Padre Eutiquio, 3775 - Condor",
        city: "Belém",
        state: "PA",
        cep: "66065-165",
        representativeName: "Guilherme Hessel",
        representativeRole: "Presidente",
        representativeCpf: "431.501.768-08",
        phone: "(11) 94836-4128",
        email: "guilherme@igh.org.br",
      },
      donataria: {
        name: "ASSOCIAÇÃO DE PESCADORES ARTESANAIS",
        document: "07.777.001/0001-96",
        street: "Água Boa S/N",
        city: "Belém",
        state: "Pará",
        contactName: "Nilson Maia Fonseca",
        phone: "(91) 98101-8145",
        email: "nilsonmaia261@gmail.com",
        zone: "URBANA",
        cep: "66000-000",
      },
      donatedAt: new Date("2026-08-25T00:00:00.000Z"),
      kitsCount: 2,
      items: [
        { name: "CPU", quantity: 2 },
        { name: "Monitor", quantity: 2 },
        { name: "Teclado", quantity: 2 },
        { name: "Mouse", quantity: 2 },
        { name: "Cabo de Força", quantity: 2 },
        { name: "Cabo de Vídeo", quantity: 2 },
      ],
    });
    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
  });
});
