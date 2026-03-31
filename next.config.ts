import type { NextConfig } from "next";
import os from "node:os";

const isWindows = process.platform === "win32";

/**
 * Limite de CPUs usadas no build (Next experimental.cpus).
 * No Windows, 1 CPU reduz picos de RAM e contenção ao escrever em `.next`
 * (erros "UNKNOWN: unknown error, write" e falhas de alocação em workers).
 * Em outros SOs, até 2 CPUs costuma ser um bom equilíbrio.
 */
const buildCpuCap = isWindows ? 1 : Math.min(2, Math.max(1, os.cpus()?.length ?? 2));

/**
 * `webpackBuildWorker` compila num processo separado — no Windows isso às vezes
 * dispara falhas de escrita (AV, indexação, dois processos no mesmo output).
 * Desativar no Windows = build mais lento, porém mais estável.
 */
const useWebpackBuildWorker = !isWindows;

const nextConfig: NextConfig = {
  /** Evita typegen de rotas em .next/dev (arquivo routes.d.ts pode corromper com muitas rotas dinâmicas). */
  typedRoutes: false,
  /** Menos trabalho e disco no build; o default já é false, deixamos explícito. */
  productionBrowserSourceMaps: false,
  /**
   * Next.js 16: o build em produção usa Turbopack por omissão (ver `next/dist/lib/bundler.js`).
   * O script `npm run build` passa `--webpack` para evitar crashes OOM / CSS no Turbopack no Windows.
   */
  experimental: {
    /** Reduz picos de memória no build com Webpack (recomendado em projetos grandes). */
    webpackMemoryOptimizations: true,
    /** No Windows fica `false` para evitar UNKNOWN write; noutros SOs ajuda a isolar RAM. */
    webpackBuildWorker: useWebpackBuildWorker,
    /** Menos paralelismo = menos RAM (troca por tempo de build). */
    cpus: buildCpuCap,
    /** Evita compilar server/edge em paralelo — reduz pico de memória. */
    parallelServerCompiles: false,
    /** Rastreio de dependências do servidor em série — menos RAM no build. */
    parallelServerBuildTraces: false,
    /**
     * Importação modular (menos módulos analisados de uma vez — ajuda RAM no build).
     * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports
     */
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "react-icons",
      "@tiptap/react",
      "@tiptap/starter-kit",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
    ],
  },
};

export default nextConfig;
