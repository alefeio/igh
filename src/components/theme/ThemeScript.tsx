/**
 * Script inline que roda antes da hidratação para evitar flash de tema.
 * Define data-theme no html com base em localStorage ou preferência do sistema.
 */
export function ThemeScript() {
  const script = `
(function() {
  var stored = localStorage.getItem('theme');
  var theme = (stored === 'dark' || stored === 'light') ? stored : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
