/**
 * Rotas públicas (sem exigir autenticação).
 * A URL não inclui "(public)" – o grupo é apenas organizacional.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
