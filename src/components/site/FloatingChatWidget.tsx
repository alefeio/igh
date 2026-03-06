"use client";

import { useState, useCallback, useEffect } from "react";
import { FaCommentDots, FaTimes } from "react-icons/fa";

type ChatContext = {
  courses: { name: string; slug: string; url: string }[];
  faq: { pergunta: string; resposta: string }[];
};

type ChatMessage = {
  id: string;
  role: "bot" | "user";
  content: string;
  links?: { label: string; href: string }[];
};

type View =
  | "initial"
  | "faq-list"
  | { faqAnswer: number }
  | "cursos"
  | "inscrever"
  | "whatsapp";

function buildWhatsAppHref(contactWhatsapp: string | null | undefined): string | null {
  const digits = (contactWhatsapp ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

const WELCOME_MESSAGE =
  "Olá! Sou o assistente do IGH. O que você precisa? Escolha uma opção abaixo.";

export function FloatingChatWidget({
  contactWhatsapp,
  labelButton = "Atendimento automático",
}: {
  contactWhatsapp: string | null | undefined;
  labelButton?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState<ChatContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: "0", role: "bot", content: WELCOME_MESSAGE },
  ]);
  const [view, setView] = useState<View>("initial");

  const whatsappHref = buildWhatsAppHref(contactWhatsapp);

  const fetchContext = useCallback(async () => {
    if (context !== null) return;
    setLoadingContext(true);
    try {
      const res = await fetch("/api/public/chat-context");
      const json = await res.json();
      if (res.ok && json?.ok && json.data) {
        setContext(json.data);
      } else {
        setContext({ courses: [], faq: [] });
      }
    } catch {
      setContext({ courses: [], faq: [] });
    } finally {
      setLoadingContext(false);
    }
  }, [context]);

  useEffect(() => {
    if (isOpen) void fetchContext();
  }, [isOpen, fetchContext]);

  const goBack = useCallback(() => {
    setMessages([{ id: "0", role: "bot", content: WELCOME_MESSAGE }]);
    setView("initial");
  }, []);

  const addMessages = useCallback(
    (userContent: string, botContent: string, links?: { label: string; href: string }[]) => {
      const userId = `u-${Date.now()}`;
      const botId = `b-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: userId, role: "user", content: userContent },
        { id: botId, role: "bot", content: botContent, links },
      ]);
    },
    []
  );

  const handleOption = useCallback(
    (option: "cursos" | "duvidas" | "inscrever" | "whatsapp") => {
      if (option === "cursos") {
        const ctx = context ?? { courses: [], faq: [] };
        if (ctx.courses.length === 0) {
          addMessages(
            "Ver cursos",
            "No momento não há cursos disponíveis na listagem. Você pode acessar a página de formações ou falar conosco pelo WhatsApp para mais informações.",
            whatsappHref ? [{ label: "Falar no WhatsApp", href: whatsappHref }] : undefined
          );
          setView("cursos");
          return;
        }
        const courseLinks = ctx.courses.map((c) => ({ label: c.name, href: c.url }));
        const botText =
          "Temos estas formações e cursos. Clique no que te interessar para ver detalhes e se inscrever.";
        addMessages("Ver cursos", botText, courseLinks);
        setView("cursos");
      } else if (option === "duvidas") {
        const ctx = context ?? { courses: [], faq: [] };
        if (ctx.faq.length === 0) {
          addMessages(
            "Tirar dúvidas",
            "Não há perguntas frequentes cadastradas no momento. Quer falar com nossa equipe?",
            whatsappHref ? [{ label: "Falar no WhatsApp", href: whatsappHref }] : undefined
          );
          setView("whatsapp");
          return;
        }
        addMessages("Tirar dúvidas", "Escolha uma pergunta:");
        setView("faq-list");
      } else if (option === "inscrever") {
        addMessages(
          "Quero me inscrever",
          "Você pode se inscrever em um curso pela nossa página de inscrição. Escolha a turma e preencha seus dados.",
          [{ label: "Ir para inscrição", href: "/inscreva" }]
        );
        setView("inscrever");
      } else {
        if (whatsappHref) {
          addMessages(
            "WhatsApp",
            "Clique no botão abaixo para abrir uma conversa no WhatsApp com nossa equipe.",
            [{ label: "Abrir WhatsApp", href: whatsappHref }]
          );
        } else {
          addMessages(
            "WhatsApp",
            "No momento o contato por WhatsApp não está configurado. Envie uma mensagem pela página de contato do site."
          );
        }
        setView("whatsapp");
      }
    },
    [context, whatsappHref, addMessages]
  );

  const handleFaqQuestion = useCallback(
    (index: number) => {
      const ctx = context ?? { courses: [], faq: [] };
      const item = ctx.faq[index];
      if (!item) return;
      addMessages(item.pergunta, item.resposta);
      setView({ faqAnswer: index });
    },
    [context, addMessages]
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setView("initial");
    setMessages([{ id: "0", role: "bot", content: WELCOME_MESSAGE }]);
  }, []);

  const ctx = context ?? { courses: [], faq: [] };
  const showInitialButtons = !loadingContext && view === "initial" && messages.length <= 1;
  const showFaqList = view === "faq-list" && ctx.faq.length > 0;
  const showFaqAnswer = typeof view === "object" && "faqAnswer" in view;
  const showCursosFooter = view === "cursos";
  const showInscreverFooter = view === "inscrever";
  const showWhatsappFooter = view === "whatsapp";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-label={labelButton}
        aria-expanded={isOpen}
        className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-[var(--igh-primary)] text-white shadow-lg transition hover:scale-105 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-offset-2 focus:ring-offset-[var(--background)]"
      >
        <FaCommentDots className="h-6 w-6" aria-hidden />
      </button>

      {isOpen && (
        <div
          className="fixed bottom-4 left-4 right-4 sm:bottom-24 sm:left-auto sm:right-6 z-[101] flex flex-col rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-xl w-auto sm:w-[min(100vw-2rem,420px)] max-h-[85vh] min-h-[70vh] sm:min-h-[400px]"
          role="dialog"
          aria-label="Chat de atendimento"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--card-border)] px-4 py-2.5">
            <span className="font-semibold text-[var(--text-primary)] text-sm sm:text-base">Atendimento IGH</span>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Fechar chat"
              className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--igh-surface)] hover:text-[var(--text-primary)]"
            >
              <FaTimes className="h-5 w-5" />
            </button>
          </div>

          {/* Uma única área rolável: mensagens + ações. Prioriza leitura. */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-4 pb-2 space-y-3">
              {loadingContext && messages.length <= 1 ? (
                <p className="text-sm text-[var(--text-muted)] py-4">Carregando...</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-lg px-3 py-2.5 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-[var(--igh-primary)] text-white"
                          : "bg-[var(--igh-surface)] text-[var(--text-primary)]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      {m.links && m.links.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {m.links.map((link) => (
                            <a
                              key={link.label}
                              href={link.href}
                              target={link.href.startsWith("http") ? "_blank" : undefined}
                              rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                              className="inline-block rounded bg-[var(--igh-primary)] px-2.5 py-1.5 text-xs text-white hover:opacity-90"
                            >
                              {link.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Ações no mesmo scroll (não fixas), para não roubar espaço de leitura */}
            <div className="p-3 pt-2 border-t border-[var(--card-border)] bg-[var(--card-bg)]">
              {showInitialButtons && (
                <>
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Escolha uma opção:</p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => handleOption("cursos")}
                      className="w-full rounded-lg bg-[var(--igh-surface)] px-3 py-2.5 text-sm font-medium text-[var(--igh-secondary)] hover:bg-[var(--igh-border)] text-left"
                    >
                      Ver cursos
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOption("duvidas")}
                      className="w-full rounded-lg bg-[var(--igh-surface)] px-3 py-2.5 text-sm font-medium text-[var(--igh-secondary)] hover:bg-[var(--igh-border)] text-left"
                    >
                      Tirar dúvidas
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOption("inscrever")}
                      className="w-full rounded-lg bg-[var(--igh-surface)] px-3 py-2.5 text-sm font-medium text-[var(--igh-secondary)] hover:bg-[var(--igh-border)] text-left"
                    >
                      Inscrever-me em um curso
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOption("whatsapp")}
                      className="w-full rounded-lg bg-[var(--igh-surface)] px-3 py-2.5 text-sm font-medium text-[var(--igh-secondary)] hover:bg-[var(--igh-border)] text-left"
                    >
                      Falar no WhatsApp
                    </button>
                  </div>
                </>
              )}

              {showFaqList && (
                <div className="flex flex-col gap-2">
                  {ctx.faq.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleFaqQuestion(i)}
                      className="w-full rounded-lg bg-[var(--igh-surface)] px-3 py-2.5 text-sm font-medium text-[var(--igh-secondary)] hover:bg-[var(--igh-border)] text-left"
                    >
                      {item.pergunta}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={goBack}
                    className="mt-1 w-full rounded-lg border border-[var(--igh-border)] bg-transparent px-3 py-2.5 text-sm font-medium text-[var(--igh-secondary)] hover:bg-[var(--igh-surface)]"
                  >
                    Voltar
                  </button>
                </div>
              )}

              {showFaqAnswer && typeof view === "object" && "faqAnswer" in view && (
                <>
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Outras perguntas:</p>
                  <div className="flex flex-col gap-2">
                    {ctx.faq
                      .map((_, i) => (i === view.faqAnswer ? null : i))
                      .filter((i): i is number => i !== null)
                      .map((i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleFaqQuestion(i)}
                          className="w-full rounded-lg bg-[var(--igh-surface)] px-3 py-2.5 text-sm font-medium text-[var(--igh-secondary)] hover:bg-[var(--igh-border)] text-left"
                        >
                          {ctx.faq[i].pergunta}
                        </button>
                      ))}
                    <button
                      type="button"
                      onClick={goBack}
                      className="mt-1 w-full rounded-lg border border-[var(--igh-border)] bg-transparent px-3 py-2.5 text-sm font-medium text-[var(--igh-secondary)] hover:bg-[var(--igh-surface)]"
                    >
                      Voltar
                    </button>
                  </div>
                </>
              )}

              {(showCursosFooter || showInscreverFooter || showWhatsappFooter) && (
                <button
                  type="button"
                  onClick={goBack}
                  className="w-full rounded-lg border border-[var(--igh-border)] bg-transparent px-3 py-2.5 text-sm font-medium text-[var(--igh-secondary)] hover:bg-[var(--igh-surface)]"
                >
                  Voltar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
