"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { FaCommentDots, FaTimes } from "react-icons/fa";

const ANA_AVATAR = "/images/Ana-Atendente-Virtual.png";
const TYPING_DELAY_MS = 1200;

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
  "Olá! Sou a Nina, atendente virtual do IGH. O que você precisa? Escolha uma opção abaixo.";

/** Âncora para abrir o chat via link (ex.: banner). Use o link /#nina ou qualquer página + #nina */
export const CHAT_OPEN_HASH = "nina";

function TypingDots() {
  return (
    <div className="flex items-center justify-start gap-1 px-3 py-2" aria-live="polite" aria-label="Nina está digitando">
      <div className="flex gap-1 rounded-lg bg-[var(--igh-surface)] px-3 py-2.5">
        <span
          className="h-2 w-2 rounded-full bg-[var(--igh-primary)] animate-bounce"
          style={{ animationDelay: "0ms", animationDuration: "0.6s" }}
        />
        <span
          className="h-2 w-2 rounded-full bg-[var(--igh-primary)] animate-bounce"
          style={{ animationDelay: "150ms", animationDuration: "0.6s" }}
        />
        <span
          className="h-2 w-2 rounded-full bg-[var(--igh-primary)] animate-bounce"
          style={{ animationDelay: "300ms", animationDuration: "0.6s" }}
        />
      </div>
    </div>
  );
}

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
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    const hash = `#${CHAT_OPEN_HASH}`;
    const openIfHash = () => {
      if (typeof window !== "undefined" && window.location.hash === hash) setIsOpen(true);
    };
    openIfHash();
    window.addEventListener("hashchange", openIfHash);
    return () => window.removeEventListener("hashchange", openIfHash);
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const goBack = useCallback(() => {
    setMessages([{ id: "0", role: "bot", content: WELCOME_MESSAGE }]);
    setView("initial");
  }, []);

  const addUserMessage = useCallback((content: string) => {
    const userId = `u-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userId, role: "user", content }]);
  }, []);

  const addBotMessage = useCallback((content: string, links?: { label: string; href: string }[]) => {
    const botId = `b-${Date.now()}`;
    setMessages((prev) => [...prev, { id: botId, role: "bot", content, links }]);
  }, []);

  const scheduleBotReply = useCallback(
    (
      userContent: string,
      botContent: string,
      nextView: View,
      links?: { label: string; href: string }[]
    ) => {
      addUserMessage(userContent);
      setIsTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        typingTimeoutRef.current = null;
        addBotMessage(botContent, links);
        setView(nextView);
        setIsTyping(false);
      }, TYPING_DELAY_MS);
    },
    [addUserMessage, addBotMessage]
  );

  const handleOption = useCallback(
    (option: "cursos" | "duvidas" | "inscrever" | "whatsapp") => {
      if (option === "cursos") {
        const ctx = context ?? { courses: [], faq: [] };
        if (ctx.courses.length === 0) {
          scheduleBotReply(
            "Ver cursos",
            "No momento não há cursos disponíveis na listagem. Você pode acessar a página de formações ou falar conosco pelo WhatsApp para mais informações.",
            "cursos",
            whatsappHref ? [{ label: "Falar no WhatsApp", href: whatsappHref }] : undefined
          );
          return;
        }
        const courseLinks = ctx.courses.map((c) => ({ label: c.name, href: c.url }));
        scheduleBotReply(
          "Ver cursos",
          "Temos estas formações e cursos. Clique no que te interessar para ver detalhes e se inscrever.",
          "cursos",
          courseLinks
        );
      } else if (option === "duvidas") {
        const ctx = context ?? { courses: [], faq: [] };
        if (ctx.faq.length === 0) {
          scheduleBotReply(
            "Tirar dúvidas",
            "Não há perguntas frequentes cadastradas no momento. Quer falar com nossa equipe?",
            "whatsapp",
            whatsappHref ? [{ label: "Falar no WhatsApp", href: whatsappHref }] : undefined
          );
          return;
        }
        scheduleBotReply("Tirar dúvidas", "Escolha uma pergunta:", "faq-list");
      } else if (option === "inscrever") {
        scheduleBotReply(
          "Quero me inscrever",
          "Você pode se inscrever em um curso pela nossa página de inscrição. Escolha a turma e preencha seus dados.",
          "inscrever",
          [{ label: "Ir para inscrição", href: "/inscreva" }]
        );
      } else {
        if (whatsappHref) {
          scheduleBotReply(
            "WhatsApp",
            "Clique no botão abaixo para abrir uma conversa no WhatsApp com nossa equipe.",
            "whatsapp",
            [{ label: "Abrir WhatsApp", href: whatsappHref }]
          );
        } else {
          scheduleBotReply(
            "WhatsApp",
            "No momento o contato por WhatsApp não está configurado. Envie uma mensagem pela página de contato do site.",
            "whatsapp"
          );
        }
      }
    },
    [context, whatsappHref, scheduleBotReply]
  );

  const handleFaqQuestion = useCallback(
    (index: number) => {
      const ctx = context ?? { courses: [], faq: [] };
      const item = ctx.faq[index];
      if (!item) return;
      scheduleBotReply(item.pergunta, item.resposta, { faqAnswer: index });
    },
    [context, scheduleBotReply]
  );

  const handleClose = useCallback(() => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsOpen(false);
    setView("initial");
    setMessages([{ id: "0", role: "bot", content: WELCOME_MESSAGE }]);
    setIsTyping(false);
    if (typeof window !== "undefined" && window.location.hash === `#${CHAT_OPEN_HASH}`) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const ctx = context ?? { courses: [], faq: [] };
  const showInitialButtons = !loadingContext && view === "initial" && messages.length <= 1 && !isTyping;
  const showFaqList = view === "faq-list" && ctx.faq.length > 0 && !isTyping;
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
          <div className="flex shrink-0 items-center gap-3 border-b border-[var(--card-border)] px-4 py-2.5">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[var(--igh-surface)]">
              <Image
                src={ANA_AVATAR}
                alt=""
                fill
                className="object-cover"
                sizes="36px"
                unoptimized
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block font-semibold text-[var(--text-primary)] text-sm sm:text-base truncate">
                Nina
              </span>
              <span className="block text-xs text-[var(--text-muted)] truncate">
                Atendente Virtual
              </span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Fechar chat"
              className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--igh-surface)] hover:text-[var(--text-primary)] shrink-0"
            >
              <FaTimes className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-4 pb-2 space-y-3">
              {loadingContext && messages.length <= 1 ? (
                <p className="text-sm text-[var(--text-muted)] py-4">Carregando...</p>
              ) : (
                <>
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} gap-2`}
                    >
                      {m.role === "bot" && (
                        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[var(--igh-surface)] mt-0.5">
                          <Image
                            src={ANA_AVATAR}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="32px"
                            unoptimized
                          />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2.5 text-sm leading-relaxed ${
                          m.role === "user"
                            ? "bg-[var(--igh-primary)] text-white"
                            : "bg-[var(--igh-surface)] text-[var(--text-primary)]"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>
                        {m.links && m.links.length > 0 && (
                          <div className="mt-2 flex flex-col gap-2">
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
                  ))}
                  {isTyping && (
                    <div className="flex gap-2">
                      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[var(--igh-surface)] mt-0.5">
                        <Image
                          src={ANA_AVATAR}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="32px"
                          unoptimized
                        />
                      </div>
                      <TypingDots />
                    </div>
                  )}
                </>
              )}
            </div>

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
