"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

type Props = {
  campaignId: string;
};

function DownloadButton({
  href,
  variant,
  label,
}: {
  href: string;
  variant: "primary" | "secondary";
  label: string;
}) {
  const [loading, setLoading] = useState(false);

  const onClick = useCallback(() => {
    // Não dá para detectar com precisão o fim do download no browser;
    // mantemos loading por um tempo curto para feedback imediato.
    setLoading(true);
    window.setTimeout(() => setLoading(false), 2500);
  }, []);

  const base =
    "inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium sm:w-auto";
  const cls =
    variant === "primary"
      ? `${base} bg-[var(--igh-primary)] text-white hover:opacity-90`
      : `${base} border border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-[var(--igh-surface)]`;

  return (
    <a
      href={href}
      className={cls}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : label}
    </a>
  );
}

export function ExportCampaignResponsesButtons({ campaignId }: Props) {
  return (
    <>
      <DownloadButton
        href={`/api/admin/marketing-campaigns/${campaignId}/export`}
        variant="primary"
        label="Exportar avaliações"
      />
      <DownloadButton
        href={`/api/admin/marketing-campaigns/${campaignId}/export-pdf`}
        variant="secondary"
        label="Exportar PDF"
      />
    </>
  );
}

