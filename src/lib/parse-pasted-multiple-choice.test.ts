import { describe, expect, it } from "vitest";

import { parsePastedMultipleChoice } from "@/lib/parse-pasted-multiple-choice";

describe("parsePastedMultipleChoice", () => {
  it("separa pergunta e A) B) C) D) com linhas em branco (exemplo do usuário)", () => {
    const raw = `O que é um briefing?

A) Um modelo pronto de postagem.

B) Um conjunto de informações que orienta o projeto.

C) Uma lista de ferramentas de design.

D) O arquivo final enviado ao cliente.
`;
    expect(parsePastedMultipleChoice(raw)).toEqual({
      question: "O que é um briefing?",
      options: [
        "Um modelo pronto de postagem.",
        "Um conjunto de informações que orienta o projeto.",
        "Uma lista de ferramentas de design.",
        "O arquivo final enviado ao cliente.",
      ],
    });
  });

  it("separa pergunta e A) B) C) sem linhas em branco", () => {
    const raw = `Qual a capital do Brasil?
A) São Paulo
B) Brasília
C) Rio de Janeiro`;
    expect(parsePastedMultipleChoice(raw)).toEqual({
      question: "Qual a capital do Brasil?",
      options: ["São Paulo", "Brasília", "Rio de Janeiro"],
    });
  });

  it("aceita prefixos A. a) 1) (A) e **A)**", () => {
    expect(
      parsePastedMultipleChoice(`Pergunta aqui
A. Primeira
B. Segunda`),
    ).toEqual({
      question: "Pergunta aqui",
      options: ["Primeira", "Segunda"],
    });

    expect(
      parsePastedMultipleChoice(`Pergunta aqui
a) Primeira
b) Segunda`),
    ).toEqual({
      question: "Pergunta aqui",
      options: ["Primeira", "Segunda"],
    });

    expect(
      parsePastedMultipleChoice(`Pergunta aqui
1) Primeira
2) Segunda`),
    ).toEqual({
      question: "Pergunta aqui",
      options: ["Primeira", "Segunda"],
    });

    expect(
      parsePastedMultipleChoice(`Pergunta aqui
(A) Primeira
(B) Segunda`),
    ).toEqual({
      question: "Pergunta aqui",
      options: ["Primeira", "Segunda"],
    });

    expect(
      parsePastedMultipleChoice(`Pergunta aqui
**A)** Primeira
**B)** Segunda`),
    ).toEqual({
      question: "Pergunta aqui",
      options: ["Primeira", "Segunda"],
    });
  });

  it("mantém pergunta multilinha antes da primeira opção", () => {
    const raw = `Leia o trecho abaixo
e escolha a alternativa correta.

A) Opção um
B) Opção dois`;
    expect(parsePastedMultipleChoice(raw)).toEqual({
      question: "Leia o trecho abaixo\ne escolha a alternativa correta.",
      options: ["Opção um", "Opção dois"],
    });
  });

  it("junta na opção anterior a linha seguinte sem prefixo", () => {
    const raw = `O que é um briefing?
A) Um conjunto de informações
que orienta o projeto.
B) Um modelo pronto de postagem.`;
    expect(parsePastedMultipleChoice(raw)).toEqual({
      question: "O que é um briefing?",
      options: [
        "Um conjunto de informações que orienta o projeto.",
        "Um modelo pronto de postagem.",
      ],
    });
  });

  it("retorna null para pergunta simples de uma linha", () => {
    expect(parsePastedMultipleChoice("O que é um briefing?")).toBeNull();
  });

  it("retorna null para duas linhas sem prefixo e sem parágrafo", () => {
    expect(parsePastedMultipleChoice("O que é um briefing?\nExplique com suas palavras.")).toBeNull();
  });

  it("usa fallback com quebra de parágrafo e 3+ linhas sem prefixo", () => {
    const raw = `O que é um briefing?

Um modelo pronto de postagem.
Um conjunto de informações que orienta o projeto.
Uma lista de ferramentas de design.`;
    expect(parsePastedMultipleChoice(raw)).toEqual({
      question: "O que é um briefing?",
      options: [
        "Um modelo pronto de postagem.",
        "Um conjunto de informações que orienta o projeto.",
        "Uma lista de ferramentas de design.",
      ],
    });
  });

  it("não usa fallback se a primeira linha já parece opção", () => {
    expect(
      parsePastedMultipleChoice(`A) Só uma opção

B) Outra`),
    ).toBeNull();
  });
});
