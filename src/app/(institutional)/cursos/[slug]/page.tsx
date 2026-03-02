import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Section, Button } from "@/components/site";
import { getCourseBySlug } from "@/lib/site-data";
import { CourseCtaFloating } from "./CourseCtaFloating";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) return { title: "Curso | IGH" };
  return {
    title: `${course.name} | Instituto Gustavo Hessel`,
    description: course.description ?? undefined,
    openGraph: {
      title: `${course.name} | IGH`,
      description: course.description ?? undefined,
    },
  };
}

export default async function CursoSlugPage({ params }: Props) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  return (
    <>
      <PageHeader
        title={course.name}
        subtitle={
          course.formationTitle
            ? `${course.formationTitle}${course.workloadHours != null ? ` • ${course.workloadHours}h` : ""}`
            : course.workloadHours != null
              ? `Carga horária: ${course.workloadHours}h`
              : undefined
        }
      />

      <Section className="pb-24">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex items-center gap-2 text-sm text-[var(--igh-muted)]">
            <Link href="/formacoes" className="hover:text-[var(--igh-primary)] hover:underline">
              Formações
            </Link>
            <span aria-hidden>/</span>
            <span className="text-[var(--igh-secondary)]">{course.name}</span>
          </nav>
          <Button
            as="link"
            href="/contato#inscreva"
            variant="primary"
            size="lg"
            className="w-full shrink-0 sm:w-auto"
          >
            Inscreva-se
          </Button>
        </div>

        <CourseCtaFloating />

        {course.imageUrl && (
          <img
            src={course.imageUrl}
            alt=""
            className="mb-8 h-56 w-full rounded-xl object-cover sm:h-72"
          />
        )}

        {course.description && (
          <p className="mb-8 w-full text-lg text-[var(--igh-muted)]">
            {course.description}
          </p>
        )}

        {course.workloadHours != null && (
          <p className="mb-8 text-sm font-medium text-[var(--igh-secondary)]">
            Carga horária: {course.workloadHours}h
          </p>
        )}

        {course.content && (
          <section className="mb-10" id="ementa">
            <h2 className="mb-4 text-xl font-bold text-[var(--igh-secondary)]">
              Ementa
            </h2>
            <div
              className="prose prose-lg max-w-none text-[var(--igh-muted)] [&_p]:mb-4"
              dangerouslySetInnerHTML={{ __html: course.content }}
            />
          </section>
        )}

        {course.modules && course.modules.length > 0 && (
          <section className="mb-10" id="grade-curricular">
            <h2 className="mb-6 text-xl font-bold text-[var(--igh-secondary)]">
              Grade Curricular
            </h2>
            <div className="space-y-8">
              {course.modules.map((mod) => (
                <article key={mod.id} className="border-l-2 border-[var(--igh-primary)] pl-6">
                  <h3 className="text-lg font-semibold text-[var(--igh-secondary)]">
                    {mod.order + 1}. {mod.title}
                  </h3>
                  {mod.description && (
                    <p className="mt-1 text-sm text-[var(--igh-muted)]">
                      {mod.description}
                    </p>
                  )}
                  <ul className="mt-4 space-y-2">
                    {mod.lessons.map((aula) => (
                      <li
                        key={aula.id}
                        className="flex flex-wrap items-baseline gap-2 text-[var(--igh-muted)]"
                      >
                        <span className="font-medium text-[var(--igh-primary)]">
                          {aula.order + 1}.
                        </span>
                        <span>{aula.title}</span>
                        {aula.durationMinutes != null && (
                          <span className="text-sm text-[var(--igh-muted)]">
                            ({aula.durationMinutes} min)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10 flex flex-wrap gap-4">
          <Button as="link" href="/formacoes" variant="outline">
            Voltar às formações
          </Button>
        </div>
      </Section>
    </>
  );
}
