import type { Metadata } from "next";

import styles from "./codo.module.css";
import { CodoSideHeader } from "./CodoSideHeader";

export const metadata: Metadata = {
  title: "Instituto Gustavo Hessel | Cursos Gratuitos (Codó)",
  description:
    "Aprenda tecnologia na prática e transforme seu futuro. Cursos 100% gratuitos do Instituto Gustavo Hessel em Codó, Maranhão.",
};

export default function CodoLandingPage() {
  return (
    <div className={styles.page}>
      <CodoSideHeader />

      <main>
        <section id="inicio" className="hero">
          <div className="container hero-conteudo">
            <div className="hero-texto">
              <span className="etiqueta etiqueta-clara">Cursos 100% gratuitos</span>

              <h1>Aprenda tecnologia na prática e transforme seu futuro.</h1>

              <p>
                Esta é a unidade do Instituto Gustavo Hessel em <strong>Codó, Maranhão</strong>. Aqui você encontra
                formação gratuita para desenvolver novas habilidades, conquistar oportunidades e se preparar para o
                mercado.
              </p>

              <div className="botoes">
                <a href="#cursos" className="botao botao-principal">
                  Ver cursos
                </a>
                <a
                  href="https://wa.me/5599991032924"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="botao botao-secundario"
                >
                  Falar no WhatsApp
                </a>
              </div>
            </div>

            <div className="hero-imagem">
              <img
                src="/images/lp/codo/banner-principal-laboratorio.jpg"
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
              <article className="card-curso">
                <div className="curso-capa" aria-hidden>
                  <img
                    src="/images/lp/codo/curso-IntroducaoInformatica.jpg"
                    alt="Curso: Introdução à Informática"
                    loading="lazy"
                  />
                </div>

                <h3>Informática Básica</h3>

                <p>
                  Aprenda ferramentas essenciais para estudar, trabalhar e usar melhor o computador no dia a dia.
                </p>
              </article>

              <article className="card-curso">
                <div className="curso-capa" aria-hidden>
                  <img
                    src="/images/lp/codo/curso-ManutencaoComputador.jpg"
                    alt="Curso: Manutenção de Computadores"
                    loading="lazy"
                  />
                </div>

                <h3>Manutenção de Computadores</h3>

                <p>
                  Entenda componentes, montagem, limpeza, diagnóstico e cuidados com equipamentos.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="beneficios" className="secao beneficios">
          <div className="container beneficios-conteudo">
            <div className="beneficios-imagem">
              <img
                src="/images/lp/codo/alunos-em-aula.jpg"
                alt="Grupo de alunos em laboratório de informática aprendendo juntos com orientação de professores"
                loading="lazy"
              />
            </div>

            <div className="beneficios-texto">
              <span className="etiqueta">Por que participar?</span>

              <h2>Capacitação gera oportunidades.</h2>

              <p>
                Aprender tecnologia pode abrir portas para estudo, trabalho, renda e crescimento pessoal. O objetivo do
                IGH é aproximar as pessoas do conhecimento de forma acessível, prática e acolhedora.
              </p>

              <ul className="lista-beneficios">
                <li>Aulas práticas e diretas</li>
                <li>Ambiente de aprendizado acolhedor</li>
                <li>Contato com tecnologia e inovação</li>
                <li>Formação para novas oportunidades</li>
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
              <div className="galeria-item">
                <img
                  src="/images/lp/codo/galeria-aluno-computador.jpg"
                  alt="Aluno concentrado usando computador em laboratório de informática"
                  loading="lazy"
                />
              </div>

              <div className="galeria-item">
                <img
                  src="/images/lp/codo/galeria-professor-explicando.jpg"
                  alt="Professor explicando conteúdo em laboratório de informática com alunos acompanhando"
                  loading="lazy"
                />
              </div>

              <div className="galeria-item">
                <img
                  src="/images/lp/codo/galeria-turma-atividade.jpg"
                  alt="Turma reunida em atividade prática usando computadores e trabalhando em grupo"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="chamada">
          <div className="container chamada-conteudo">
            <h2>Seu futuro começa com uma decisão.</h2>

            <p>
              Dê o próximo passo. Conhecimento pode transformar sua rotina, sua confiança e suas oportunidades.
            </p>

            <a href="#contato" className="botao botao-principal">
              Quero me inscrever
            </a>
          </div>
        </section>

        <section id="contato" className="secao contato">
          <div className="container contato-conteudo">
            <div className="contato-texto">
              <span className="etiqueta">Contato</span>

              <h2>Fale com o Instituto Gustavo Hessel em Codó/MA</h2>

              <p>
                Entre em contato para saber mais sobre turmas, horários, inscrições e locais de aula.
              </p>
            </div>

            <div className="card-contato">
              <h3>Informações</h3>

              <p>
                <strong>WhatsApp:</strong> 99 99103-2924
              </p>
              <p>
                <strong>Local:</strong> Colégio Militar 2 de Julho - Espaço Maker
              </p>
              <p>
                <strong>Cidade:</strong> Codó, Maranhão
              </p>

              <a
                href="https://wa.me/5599991032924"
                target="_blank"
                rel="noopener noreferrer"
                className="botao botao-principal"
              >
                Chamar no WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="rodape">
        <div className="container rodape-conteudo">
          <p>Instituto Gustavo Hessel - Codó/MA © 2026</p>
          <p>Tecnologia que aproxima. Educação que transforma.</p>
        </div>
      </footer>
    </div>
  );
}

