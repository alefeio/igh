import styles from "@/app/(institutional)/codo/codo.module.css";
import type { SiteUnitPublic } from "@/lib/site-data";
import { UnitSideHeader } from "@/components/site/UnitSideHeader";

type Props = { unit: SiteUnitPublic };

type UnitCourseCard = {
  id: string;
  name: string;
  slug?: string;
  description: string | null;
  imageUrl: string | null;
};

export function UnitLandingPageContent({ unit }: Props) {
  const brandLabel = `IGH — ${unit.city}`.toUpperCase();
  const cityState = `${unit.city}, ${unit.state}`;
  const cityStateShort = `${unit.city}/${unit.state}`;
  const whatsappHref = `https://wa.me/${unit.whatsapp ?? "5599991032924"}`;

  const courses: UnitCourseCard[] = unit.courses?.length
    ? unit.courses
    : [
        {
          id: "fallback-1",
          name: "Informática Básica",
          description:
            "Aprenda ferramentas essenciais para estudar, trabalhar e usar melhor o computador no dia a dia.",
          imageUrl: null,
        },
        {
          id: "fallback-2",
          name: "Manutenção de Computadores",
          description: "Entenda componentes, montagem, limpeza, diagnóstico e cuidados com equipamentos.",
          imageUrl: null,
        },
      ];

  return (
    <div className={styles.page}>
      <UnitSideHeader brandLabel={brandLabel} />

      <main>
        <section id="inicio" className="hero">
          <div className="container hero-conteudo">
            <div className="hero-texto">
              <span className="etiqueta etiqueta-clara">{unit.heroBadge ?? "Cursos 100% gratuitos"}</span>

              <h1>{unit.heroTitle ?? "Aprenda tecnologia na prática e transforme seu futuro."}</h1>

              <p>
                {unit.heroText?.trim() ? (
                  unit.heroText
                ) : (
                  <>
                    Esta é a unidade do Instituto Gustavo Hessel em <strong>{cityState}</strong>. Aqui você encontra
                    formação gratuita para desenvolver novas habilidades, conquistar oportunidades e se preparar para o
                    mercado.
                  </>
                )}
              </p>

              <div className="botoes">
                <a href="/inscreva" className="botao botao-principal">
                  Quero me inscrever
                </a>
                <a href="#cursos" className="botao botao-secundario">
                  Ver cursos
                </a>
              </div>
            </div>

            <div className="hero-imagem">
              <img
                src={unit.heroImageUrl ?? "/images/lp/codo/banner-principal-laboratorio.jpg"}
                alt="Aluno usando computador em laboratório de informática com professora orientando ao fundo"
                loading="eager"
              />
            </div>
          </div>
        </section>

        <section id="cursos" className="secao cursos">
          <div className="container">
            <div className="titulo-secao">
              <span className="etiqueta">Formação prática</span>

              <h2>Nossos cursos</h2>

              <p>
                Escolha uma área para começar sua jornada de aprendizado com aulas práticas e foco em desenvolvimento
                real.
              </p>
            </div>

            <div className="grid-cursos">
              {courses.map((c) => {
                const isRealCourse = !c.id.startsWith("fallback-");
                const enrollHref = isRealCourse
                  ? `/inscreva?courseId=${encodeURIComponent(c.id)}`
                  : "/inscreva";
                const detailsHref = c.slug ? `/cursos/${encodeURIComponent(c.slug)}` : null;

                return (
                  <article key={c.id} className="card-curso">
                    {c.imageUrl ? (
                      <div className="curso-capa">
                        <img src={c.imageUrl} alt={`Capa do curso ${c.name}`} loading="lazy" />
                      </div>
                    ) : null}
                    <h3>{c.name}</h3>
                    <p>{c.description ?? ""}</p>
                    <div className="botoes" style={{ marginTop: "1rem", flexWrap: "wrap" }}>
                      <a href={enrollHref} className="botao botao-principal">
                        Inscrever-se
                      </a>
                      {detailsHref ? (
                        <a href={detailsHref} className="botao botao-secundario">
                          Ver detalhes
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="beneficios" className="secao beneficios">
          <div className="container beneficios-conteudo">
            <div className="beneficios-imagem">
              <img
                src={unit.benefitsImageUrl ?? "/images/lp/codo/alunos-em-aula.jpg"}
                alt="Grupo de alunos em laboratório de informática aprendendo juntos com orientação de professores"
                loading="lazy"
              />
            </div>

            <div className="beneficios-texto">
              <span className="etiqueta">{unit.benefitsBadge ?? "Por que participar?"}</span>

              <h2>{unit.benefitsTitle ?? "Capacitação gera oportunidades."}</h2>

              <p>
                {unit.benefitsText?.trim()
                  ? unit.benefitsText
                  : "Aprender tecnologia pode abrir portas para estudo, trabalho, renda e crescimento pessoal. O objetivo do IGH é aproximar as pessoas do conhecimento de forma acessível, prática e acolhedora."}
              </p>

              <ul className="lista-beneficios">
                {(unit.benefitsBullets?.length
                  ? unit.benefitsBullets
                  : [
                      "Aulas práticas e diretas",
                      "Ambiente de aprendizado acolhedor",
                      "Contato com tecnologia e inovação",
                      "Formação para novas oportunidades",
                    ]
                ).map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="galeria" className="secao galeria">
          <div className="container">
            <div className="titulo-secao">
              <span className="etiqueta">Nossa rotina</span>

              <h2>Aprendizado na prática</h2>

              <p>
                Veja como a prática, a orientação e o trabalho em grupo fazem parte da experiência de aprendizagem.
              </p>
            </div>

            <div className="grid-galeria">
              {(unit.galleryImages?.length
                ? unit.galleryImages
                : [
                    "/images/lp/codo/galeria-aluno-computador.jpg",
                    "/images/lp/codo/galeria-professor-explicando.jpg",
                    "/images/lp/codo/galeria-turma-atividade.jpg",
                  ]
              ).map((url) => (
                <div key={url} className="galeria-item">
                  <img src={url} alt="Foto da unidade" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="chamada">
          <div className="container chamada-conteudo">
            <h2>Seu futuro começa com uma decisão.</h2>

            <p>Dê o próximo passo. Conhecimento pode transformar sua rotina, sua confiança e suas oportunidades.</p>

            <a href="/inscreva" className="botao botao-principal">
              Quero me inscrever
            </a>
          </div>
        </section>

        <section id="contato" className="secao contato">
          <div className="container contato-conteudo">
            <div className="contato-texto">
              <span className="etiqueta">Contato</span>

              <h2>Fale com o Instituto Gustavo Hessel em {cityStateShort}</h2>

              <p>Entre em contato para saber mais sobre turmas, horários, inscrições e locais de aula.</p>
            </div>

            <div className="card-contato">
              <h3>Informações</h3>

              <p>
                <strong>WhatsApp:</strong> {unit.whatsapp ? unit.whatsapp.replace(/^55/, "") : "99 99103-2924"}
              </p>
              <p>
                <strong>Local:</strong> {unit.locationName ?? "—"}
              </p>
              <p>
                <strong>Cidade:</strong> {cityState}
              </p>

              <div className="botoes" style={{ marginTop: "1rem", flexDirection: "column" }}>
                <a href="/inscreva" className="botao botao-principal">
                  Ir para inscrição
                </a>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="botao botao-secundario"
                >
                  Chamar no WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="rodape">
        <div className="container rodape-conteudo">
          <p>
            Instituto Gustavo Hessel — {cityStateShort} © {new Date().getFullYear()}
          </p>
          <p>Tecnologia que aproxima. Educação que transforma.</p>
        </div>
      </footer>
    </div>
  );
}
