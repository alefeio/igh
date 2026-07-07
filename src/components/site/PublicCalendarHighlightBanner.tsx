import type { HolidayCalendarBannerPublic } from "@/lib/holiday-calendar-banner";
import { Button } from "./Button";

export function PublicCalendarHighlightBanner({
  banner,
}: {
  banner: HolidayCalendarBannerPublic | null;
}) {
  if (!banner) return null;

  const hasImage = !!banner.imageUrl?.trim();

  return (
    <section
      className={`relative mb-8 overflow-hidden rounded-2xl border border-[var(--igh-border)] ${
        hasImage ? "min-h-[9rem] text-white" : "bg-gradient-to-r from-[var(--igh-secondary-solid)] via-[#1e3a5f] to-[var(--igh-primary)] text-white"
      }`}
    >
      {hasImage ? (
        <>
          <img
            src={banner.imageUrl!}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--igh-secondary-solid)]/90 via-[#1e3a5f]/80 to-[var(--igh-primary)]/70" />
        </>
      ) : null}
      <div className="relative flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-7">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Destaque</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{banner.title}</h2>
          {banner.subtitle ? (
            <p className="mt-2 max-w-3xl text-sm text-white/90 sm:text-base">{banner.subtitle}</p>
          ) : null}
        </div>
        {banner.ctaLabel && banner.ctaHref ? (
          <Button
            as="link"
            href={banner.ctaHref}
            size="lg"
            className="shrink-0 !bg-white !text-[var(--igh-secondary-solid)] hover:!bg-white/90"
          >
            {banner.ctaLabel}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
