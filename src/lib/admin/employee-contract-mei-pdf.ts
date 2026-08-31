import "server-only";

import fs from "fs";
import path from "path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

const FONT_REGULAR_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSans-Regular.ttf");
const FONT_BOLD_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSans-Bold.ttf");
const LOGO_IGH_PATH = path.join(process.cwd(), "assets", "gerencia", "termo-doacao", "logo-igh.png");

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 54;
const FOOTER_HEIGHT = 52;
const HEADER_BOTTOM_Y = PAGE_HEIGHT - 92;
const CONTINUATION_HEADER_BOTTOM_Y = PAGE_HEIGHT - 68;
const CONTENT_BOTTOM_Y = FOOTER_HEIGHT + 18;

const TEXT = rgb(0.08, 0.1, 0.14);
const WHITE = rgb(1, 1, 1);
const FOOTER_BG = rgb(0, 0, 0);

const FOOTER_LINES = [
  "IGH – INSTITUTO GUSTAVO HESSEL",
  "TV. Padre eutiquio, nº 3775 - Condor",
  "CEP: 66065-165 – Belém - PA",
  "Fone: (91) 3235-9320",
] as const;

export const MEI_SERVICE_CONTRACT_TEMPLATE_TITLE = "Contrato de prestação de serviços (MEI)";

export function isMeiServiceContractTemplate(title: string | null | undefined): boolean {
  return title?.trim() === MEI_SERVICE_CONTRACT_TEMPLATE_TITLE;
}

function v(vars: Record<string, string>, key: string): string {
  const value = vars[key]?.trim();
  return value && value !== "—" ? value : "";
}

function wrapLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function buildParagraphs(vars: Record<string, string>): Array<{
  kind: "title" | "heading" | "paragraph" | "date" | "signature" | "page_break";
  text: string;
}> {
  const instituto = v(vars, "instituto.nome") || "Instituto";
  const cargo = v(vars, "funcionario.cargo") || "—";
  const valor = v(vars, "contrato.valor") || "R$ —";
  const valorExtenso = v(vars, "contrato.valor_extenso") || "—";
  const convenio = v(vars, "contrato.convenio") || "—";
  const duracao = v(vars, "contrato.duracao_meses") || v(vars, "contrato.duracao") || "—";
  const inicio = v(vars, "contrato.inicio_extenso") || v(vars, "contrato.inicio") || "__/__/____";
  const fim = v(vars, "contrato.fim_extenso") || v(vars, "contrato.fim") || "__/__/____";
  const email = v(vars, "funcionario.email") || "—";
  const cidade = v(vars, "instituto.cidade") || "Belém";
  const data = v(vars, "contrato.data") || "____ de __________ de ________";
  const logradouro = v(vars, "instituto.logradouro");
  const cep = v(vars, "instituto.cep");
  const cidadeInst = v(vars, "instituto.cidade");
  const estadoInst = v(vars, "instituto.estado");
  const sedeParts = [logradouro, cep ? `CEP: ${cep}` : "", cidadeInst && estadoInst ? `${cidadeInst}, ${estadoInst}` : ""]
    .filter(Boolean)
    .join(", ");

  const contratante = [
    instituto,
    v(vars, "instituto.cnpj") ? `inscrito no CNPJ nº ${v(vars, "instituto.cnpj")}` : "",
    sedeParts ? `com sede na ${sedeParts}` : "",
    v(vars, "instituto.responsavel")
      ? `neste ato representado por seu Presidente, ${v(vars, "instituto.responsavel")}${v(vars, "instituto.responsavel_estado_civil") ? `, ${v(vars, "instituto.responsavel_estado_civil")}` : ""}${v(vars, "instituto.cargo") ? `, ${v(vars, "instituto.cargo")}` : ""}${v(vars, "instituto.responsavel_rg") ? `, RG ${v(vars, "instituto.responsavel_rg")}` : ""}${v(vars, "instituto.cpf") ? `, CPF ${v(vars, "instituto.cpf")}` : ""}${v(vars, "instituto.responsavel_endereco") ? `, residente em ${v(vars, "instituto.responsavel_endereco")}` : ""}`
      : "",
  ]
    .filter(Boolean)
    .join(", ");

  const contratado = [
    v(vars, "funcionario.nome") || "—",
    v(vars, "funcionario.nacionalidade") || "brasileiro(a)",
    v(vars, "funcionario.estado_civil") || "",
    v(vars, "funcionario.rg") ? `RG ${v(vars, "funcionario.rg")}` : "",
    v(vars, "funcionario.cpf") ? `CPF ${v(vars, "funcionario.cpf")}` : "",
    v(vars, "funcionario.cidade_estado") ? `residente em ${v(vars, "funcionario.cidade_estado")}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return [
    { kind: "title", text: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS" },
    {
      kind: "paragraph",
      text: `${contratante}; e, de outro lado, ${contratado}. Pelo presente instrumento particular de Contrato de Prestação de Serviços, as partes acima qualificadas têm entre si justas e avençadas o seguinte:`,
    },
    { kind: "heading", text: "CLÁUSULA PRIMEIRA – DO OBJETO" },
    {
      kind: "paragraph",
      text: `Para atender às exigências do Convênio nº ${convenio}, a CONTRATANTE firma o presente contrato com o(a) CONTRATADO(A), o(a) qual se obriga a prestar à CONTRATANTE serviço profissional na área de ${cargo}, sob o regime de prestador de serviços MEI, assumindo a responsabilidade perante o órgão de fiscalização profissional e outros que lhe exijam.`,
    },
    { kind: "heading", text: "CLÁUSULA SEGUNDA – DAS CONDIÇÕES DE EXECUÇÃO DOS SERVIÇOS" },
    {
      kind: "paragraph",
      text: `A CONTRATANTE deverá indicar o(a) CONTRATADO(A) como ${cargo} perante o Conselho Deliberativo e, simultaneamente, o(a) CONTRATADO(A) deverá assinar Declaração – Termo de Responsabilidade perante aquele conselho.`,
    },
    { kind: "heading", text: "CLÁUSULA TERCEIRA – DA REMUNERAÇÃO" },
    {
      kind: "paragraph",
      text: `O(A) CONTRATADO(A) é responsável por eventuais retenções de impostos previstas na legislação tributária e previdenciária e receberá, até o 5º dia útil do mês subsequente àquele do serviço efetivamente prestado, a importância de ${valor} (${valorExtenso}). O pagamento será efetuado por meio de depósito em conta corrente PJ do(a) CONTRATADO(A), mediante apresentação e envio de nota fiscal emitida pelo(a) mesmo(a) por e-mail (${email}).`,
    },
    { kind: "heading", text: "CLÁUSULA QUARTA – DA VIGÊNCIA" },
    {
      kind: "paragraph",
      text: `O presente contrato é firmado no período de ${duracao}, de ${inicio} a ${fim}, podendo ser prorrogado de acordo com o desempenho positivo e satisfatório do colaborador junto ao instituto. O(A) contratado(a) cede o direito de imagem para divulgação e promoção do instituto. O presente contrato pode ser rescindido por qualquer das partes; neste caso, a CONTRATANTE pagará ao(à) CONTRATADO(A) o valor correspondente ao tempo de serviço efetivamente prestado, não se aplicando a cláusula sexta.`,
    },
    { kind: "page_break", text: "" },
    { kind: "heading", text: "CLÁUSULA SEXTA – DA RESCISÃO" },
    {
      kind: "paragraph",
      text: "O presente contrato poderá ser rescindido por qualquer uma das partes, mediante notificação previa a outra por escrito, ressalvada a hipótese de a parte denunciante optar por indenizar a outra do valor correspondente ao da prestação dos serviços referente ao período.",
    },
    {
      kind: "paragraph",
      text: "Parágrafo 1º – O contrato também poderá ser rescindido em caso de violação de quaisquer das cláusulas deste contrato e do regimento do instituto, pela parte prejudicada, mediante denúncia imediata, sem prejuízo de eventual indenização cabível.",
    },
    {
      kind: "paragraph",
      text: "Parágrafo 2º – Qualquer tolerância das partes quanto ao descumprimento das cláusulas do presente contrato constituirá mera liberalidade, não configurando renúncia ou novação do contrato ou de suas cláusulas que poderão ser exigidos a qualquer tempo.",
    },
    { kind: "heading", text: "CLÁUSULA SÉTIMA – DO REGIME JURÍDICO" },
    {
      kind: "paragraph",
      text: "As partes declaram não haver entre si vínculo empregatício, tendo o (a) CONTRATADO (A) plena autonomia na prestação dos serviços, desde que prestados conforme as condições ora pactuadas e demais exigências legais do Conselho Deliberativo quanto à responsabilidade. O (a) CONTRATADO (A) responde exclusivamente por eventual imprudência, negligência, imperícia ou dolo na execução de serviços que venham a causar qualquer dano à CONTRATANTE ou a terceiros, devendo responder regressivamente caso a CONTRATANTE seja responsabilizada judicialmente por tais fatos, desde que haja a denunciação da lide, salvo no caso de conduta da própria CONTRATANTE contrária à orientação dada pelo (a) CONTRATADO (A).",
    },
    { kind: "heading", text: "CLÁUSULA OITAVA – DO FORO DE ELEIÇÃO" },
    {
      kind: "paragraph",
      text: `As partes elegem o foro da Comarca da Cidade de ${cidade}, para qualquer demanda judicial relativa ao presente contrato, com exclusão de qualquer outro, e por estarem justas e contratadas, na melhor forma de direito, as partes assinam o presente instrumento em 02 (Duas) vias originais e de igual teor e forma, dando tudo por bom, firme e valioso.`,
    },
    { kind: "date", text: `${cidade}, ${data}.` },
    { kind: "signature", text: `_______________________________\n${v(vars, "funcionario.nome") || "Contratado(a)"}` },
    { kind: "signature", text: `_______________________________\n${instituto}` },
  ];
}

async function embedLogo(doc: PDFDocument): Promise<PDFImage> {
  const bytes = fs.readFileSync(LOGO_IGH_PATH);
  return doc.embedPng(bytes);
}

function drawFooter(page: PDFPage, font: PDFFont) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: FOOTER_HEIGHT,
    color: FOOTER_BG,
  });
  const size = 7.5;
  let y = FOOTER_HEIGHT - 11;
  for (const line of FOOTER_LINES) {
    const width = font.widthOfTextAtSize(line, size);
    page.drawText(line, {
      x: (PAGE_WIDTH - width) / 2,
      y,
      size,
      font,
      color: WHITE,
    });
    y -= 9;
  }
}

function drawHeader(page: PDFPage, logo: PDFImage, fontBold: PDFFont, withTitle: boolean) {
  const logoHeight = 42;
  const logoWidth = (logo.width / logo.height) * logoHeight;
  page.drawImage(logo, {
    x: MARGIN_X,
    y: PAGE_HEIGHT - logoHeight - 16,
    width: logoWidth,
    height: logoHeight,
  });

  if (!withTitle) return;

  const title = "CONTRATO DE PRESTAÇÃO DE SERVIÇOS";
  const titleSize = 13;
  const titleWidth = fontBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y: PAGE_HEIGHT - 48,
    size: titleSize,
    font: fontBold,
    color: TEXT,
  });
}

function startPage(
  doc: PDFDocument,
  logo: PDFImage,
  fontBold: PDFFont,
  fontRegular: PDFFont,
  withTitle: boolean,
): { page: PDFPage; y: number } {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawHeader(page, logo, fontBold, withTitle);
  drawFooter(page, fontRegular);
  return { page, y: withTitle ? HEADER_BOTTOM_Y : CONTINUATION_HEADER_BOTTOM_Y };
}

function drawRightAligned(page: PDFPage, text: string, font: PDFFont, size: number, y: number, maxWidth: number) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: MARGIN_X + maxWidth - width,
    y,
    size,
    font,
    color: TEXT,
  });
}

/** PDF do contrato MEI no layout oficial IGH (logo, rodapé, texto do modelo físico). */
export async function renderMeiServiceContractPdfBytes(vars: Record<string, string>): Promise<Uint8Array> {
  const regularBytes = fs.readFileSync(FONT_REGULAR_PATH);
  const boldBytes = fs.readFileSync(FONT_BOLD_PATH);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fontRegular = await doc.embedFont(regularBytes, { subset: true });
  const fontBold = await doc.embedFont(boldBytes, { subset: true });
  const logo = await embedLogo(doc);

  const maxWidth = PAGE_WIDTH - MARGIN_X * 2;
  const blocks = buildParagraphs(vars).filter((b) => b.kind !== "title");

  let { page, y } = startPage(doc, logo, fontBold, fontRegular, true);

  const ensureSpace = (needed: number) => {
    if (y - needed >= CONTENT_BOTTOM_Y) return;
    ({ page, y } = startPage(doc, logo, fontBold, fontRegular, false));
  };

  for (const block of blocks) {
    if (block.kind === "page_break") {
      ({ page, y } = startPage(doc, logo, fontBold, fontRegular, false));
      continue;
    }

    if (block.kind === "heading") {
      const size = 10.5;
      ensureSpace(size + 10);
      y -= 6;
      page.drawText(block.text, {
        x: MARGIN_X,
        y,
        size,
        font: fontBold,
        color: TEXT,
      });
      y -= size + 8;
      continue;
    }

    if (block.kind === "date") {
      const size = 10.5;
      ensureSpace(size + 16);
      y -= 10;
      drawRightAligned(page, block.text, fontRegular, size, y, maxWidth);
      y -= size + 14;
      continue;
    }

    if (block.kind === "signature") {
      const size = 10.5;
      ensureSpace(42);
      y -= 18;
      for (const line of block.text.split("\n")) {
        if (line.startsWith("_")) {
          const lineWidth = fontRegular.widthOfTextAtSize(line, size);
          page.drawText(line, {
            x: MARGIN_X + (maxWidth - lineWidth) / 2,
            y,
            size,
            font: fontRegular,
            color: TEXT,
          });
        } else {
          const lineWidth = fontRegular.widthOfTextAtSize(line, size);
          page.drawText(line, {
            x: MARGIN_X + (maxWidth - lineWidth) / 2,
            y: y - 14,
            size,
            font: fontRegular,
            color: TEXT,
          });
        }
        y -= 14;
      }
      y -= 8;
      continue;
    }

    const size = 10.5;
    const wrapped = wrapLines(block.text, fontRegular, size, maxWidth);
    for (const line of wrapped) {
      ensureSpace(size + 6);
      page.drawText(line, { x: MARGIN_X, y, size, font: fontRegular, color: TEXT });
      y -= size + 4;
    }
    y -= 4;
  }

  return doc.save();
}
