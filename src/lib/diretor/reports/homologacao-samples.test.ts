import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { config as loadEnv } from "dotenv";

loadEnv();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(async () => ({ id: "audit-homolog" })) }));

const prismaReady = existsSync("src/generated/prisma/client.ts");
const enabled = process.env.RUN_DIRECTOR_REPORTS === "1" && prismaReady;
const outDir = path.join(process.cwd(), "tmp/homologacao-1c");

const TYPES = ["executive", "academic", "offer", "social", "financial", "administrative"] as const;

describe.skipIf(!enabled)("amostras reais de relatórios 1C", () => {
  it(
    "gera PDF/XLSX/CSV, reabre XLSX e extrai texto do PDF",
    async () => {
      const { generateDirectorReport } = await import("@/lib/diretor/reports/generate");
      mkdirSync(outDir, { recursive: true });
      const notes: string[] = [];

      for (const type of TYPES) {
        for (const format of ["pdf", "xlsx", "csv"] as const) {
          const result = await generateDirectorReport({ type, format }, "DIRECTOR", "homologacao-1c");
          const dest = path.join(outDir, result.filename);
          const buf = Buffer.isBuffer(result.body) ? result.body : Buffer.from(result.body);
          writeFileSync(dest, buf);
          expect(result.mime).toBeTruthy();
          expect(result.filename).toMatch(/^diretor-[a-z0-9-]+\.(pdf|xlsx|csv)$/);
          notes.push(`${result.filename} mime=${result.mime} bytes=${buf.length}`);

          if (format === "pdf") {
            expect(buf.subarray(0, 4).toString()).toBe("%PDF");
            const { CanvasFactory } = await import("pdf-parse/worker");
            const { PDFParse } = await import("pdf-parse");
            const parser = new PDFParse({ data: Uint8Array.from(buf), CanvasFactory });
            try {
              const parsed = await parser.getText();
              const text = parsed.text ?? "";
              expect(text.toLowerCase()).not.toMatch(/cpf\s*\d/);
              expect(text).toMatch(/Dados atualizados|IGH|INAC/i);
              expect(text).not.toMatch(/\{"[a-z]+":/);
              writeFileSync(path.join(outDir, `${type}.pdf.txt`), text);
            } finally {
              await parser.destroy().catch(() => undefined);
            }
          }

          if (format === "xlsx") {
            expect(buf[0]).toBe(0x50);
            expect(buf[1]).toBe(0x4b);
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(buf as never);
            const names = wb.worksheets.map((s) => s.name);
            expect(names).toEqual(expect.arrayContaining(["Resumo", "Indicadores", "Alertas", "Qualidade", "Definições"]));
            expect(names).not.toContain("Séries");
            for (const ws of wb.worksheets) {
              expect(ws.views?.[0]?.state).toBe("frozen");
              expect(ws.autoFilter).toBeTruthy();
            }
            const blob = JSON.stringify(wb.worksheets.map((s) => s.getSheetValues()));
            expect(blob.toLowerCase()).not.toMatch(/\bcpf\b/);
            expect(blob).not.toMatch(/(^|[;\t])=(CMD|SUM|HYPERLINK)/i);
          }

          if (format === "csv") {
            const csv = buf.toString("utf8");
            expect(csv.charCodeAt(0)).toBe(0xfeff);
            expect(csv).not.toMatch(/\r\n=(CMD|SUM)/);
          }
        }
      }

      const pdftoppm = spawnSync("pdftoppm", ["-v"], { encoding: "utf8" });
      const magick = spawnSync("magick", ["-version"], { encoding: "utf8" });
      if (pdftoppm.status === 0 || pdftoppm.stderr?.includes("pdftoppm")) {
        for (const type of TYPES) {
          spawnSync("pdftoppm", ["-png", path.join(outDir, `diretor-${type}.pdf`), path.join(outDir, `pdf-${type}`)], {
            encoding: "utf8",
          });
        }
        notes.push("pdftoppm: imagens geradas");
      } else if ((magick.status ?? 1) === 0) {
        notes.push("ImageMagick disponível; pdftoppm ausente");
      } else {
        notes.push("Sem pdftoppm/ImageMagick: páginas PDF não rasterizadas neste ambiente");
      }

      const soffice = spawnSync("soffice", ["--version"], { encoding: "utf8" });
      notes.push(
        soffice.status === 0 || soffice.stdout
          ? `LibreOffice: ${(soffice.stdout || soffice.stderr || "").slice(0, 80)}`
          : "LibreOffice ausente",
      );

      writeFileSync(path.join(outDir, "relatorios-notas.txt"), notes.join("\n"));
      expect(TYPES.length).toBe(6);
    },
    600_000,
  );
});
