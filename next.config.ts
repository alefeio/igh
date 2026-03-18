import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Evita typegen de rotas em .next/dev (arquivo routes.d.ts pode corromper com muitas rotas dinâmicas). */
  typedRoutes: false,
};

export default nextConfig;
