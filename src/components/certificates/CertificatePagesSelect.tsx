"use client";

export type CertificatePagesMode = "front" | "both";

type Props = {
  value: CertificatePagesMode;
  onChange: (value: CertificatePagesMode) => void;
  id?: string;
  className?: string;
};

/** Escolha de páginas do PDF nos downloads em lote de certificados. */
export function CertificatePagesSelect({ value, onChange, id, className }: Props) {
  return (
    <label className={`inline-flex flex-col gap-0.5 text-xs text-[var(--text-muted)] ${className ?? ""}`}>
      <span>Páginas do certificado</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value === "front" ? "front" : "both")}
        className="rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
      >
        <option value="both">Frente e verso</option>
        <option value="front">Somente frente</option>
      </select>
    </label>
  );
}

export function certificatePagesQuery(pages: CertificatePagesMode): string {
  return `pages=${pages}`;
}
