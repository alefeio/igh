import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Evita typegen de rotas em .next/dev (arquivo routes.d.ts pode corromper com muitas rotas dinâmicas). */
  typedRoutes: false,
  /**
   * Next.js 16: o build em produção usa Turbopack por omissão (ver `next/dist/lib/bundler.js`).
   * O script `npm run build` passa `--webpack` para evitar crashes OOM / CSS no Turbopack no Windows.
   */
  experimental: {
    /** Reduz picos de memória no build com Webpack (recomendado em projetos grandes). */
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
