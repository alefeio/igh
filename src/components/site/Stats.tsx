import { Container } from "./Container";

type StatItem = { value: string; label: string };

export function Stats({ items }: { items: readonly StatItem[] }) {
  return (
    <section className="bg-[var(--igh-surface)] py-12 sm:py-16">
      <Container>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
          {items.map((item, i) => (
            <div key={i} className="text-center">
              <p className="text-2xl font-bold text-[var(--igh-primary)] sm:text-3xl lg:text-4xl">{item.value}</p>
              <p className="mt-1 text-sm font-medium text-[var(--igh-muted)] sm:text-base">{item.label}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
