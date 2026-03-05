"use client";

import { useState } from "react";
import { Section } from "./Section";
import { Card } from "./Card";
import { Button } from "./Button";
import { Modal } from "@/components/ui/Modal";

type Depoimento = { nome: string; role: string; texto: string; avatar?: string };

const inputClass =
  "mt-1 w-full rounded-md border border-[var(--igh-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--igh-primary)]";

type CourseOption = { id: string; name: string };

export function Testimonials({
  title = "O que dizem nossos alunos",
  items,
  courses = [],
}: {
  title?: string;
  items: readonly Depoimento[];
  courses?: readonly CourseOption[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [roleOrContext, setRoleOrContext] = useState("");
  const [quote, setQuote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setRoleOrContext("");
    setQuote("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setError(null);
  }

  function closeModal() {
    setModalOpen(false);
    setTimeout(() => {
      resetForm();
      setSuccess(false);
    }, 200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    if (!quote.trim()) {
      setError("Depoimento é obrigatório.");
      return;
    }
    setSubmitting(true);
    try {
      let photoUrl: string | undefined;
      if (photoFile) {
        const formData = new FormData();
        formData.append("photo", photoFile);
        const uploadRes = await fetch("/api/public/testimonial-photo", {
          method: "POST",
          body: formData,
        });
        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok || !uploadJson?.ok) {
          setError(uploadJson?.error?.message ?? "Falha ao enviar a foto.");
          return;
        }
        photoUrl = uploadJson.data?.url;
      }

      const res = await fetch("/api/public/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          roleOrContext: roleOrContext.trim() || undefined,
          quote: quote.trim(),
          photoUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setError(json?.error?.message ?? "Falha ao enviar depoimento.");
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar.");
    } finally {
      setSubmitting(false);
    }
  }

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPhotoFile(file ?? null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  return (
    <Section title={title} background="muted">
      {items.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((d, i) => (
            <Card key={i} as="article">
              <p className="text-[var(--igh-secondary)]">&ldquo;{d.texto}&rdquo;</p>
              <div className="mt-4 flex items-center gap-3">
                {d.avatar ? (
                  <img
                    src={d.avatar}
                    alt=""
                    className="h-10 w-10 flex-shrink-0 rounded-full object-cover bg-[var(--igh-surface)]"
                  />
                ) : (
                  <div className="h-10 w-10 flex-shrink-0 rounded-full bg-[var(--igh-surface)]" aria-hidden />
                )}
                <div>
                  <p className="font-semibold text-[var(--igh-secondary)]">{d.nome}</p>
                  <p className="text-sm text-[var(--igh-muted)]">{d.role}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-center text-[var(--igh-muted)]">
          Nenhum depoimento publicado ainda. Compartilhe sua experiência com a gente!
        </p>
      )}

      <div className="mt-8 text-center">
        <Button variant="outline" size="lg" onClick={() => setModalOpen(true)}>
          Deixe seu depoimento
        </Button>
      </div>

      <Modal open={modalOpen} title="Deixe seu depoimento" onClose={closeModal}>
        <div className="rounded-b-lg bg-[var(--card-bg)] text-[var(--text-primary)]">
          {success ? (
            <div className="py-4 text-center">
              <p className="text-[var(--igh-secondary)] font-medium">
                Depoimento enviado! Ele será publicado após aprovação.
              </p>
              <Button variant="primary" onClick={closeModal} className="mt-4">
                Fechar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-[var(--text-primary)]">Seu nome *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="Ex.: Maria Silva"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  Curso (opcional)
                </label>
                <select
                  value={roleOrContext}
                  onChange={(e) => setRoleOrContext(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecione</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-primary)]">Seu depoimento *</label>
                <textarea
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  className={`${inputClass} min-h-[120px] resize-y`}
                  placeholder="Conte sua experiência..."
                  maxLength={2000}
                  rows={4}
                />
                <p className="mt-1 text-xs text-[var(--text-muted)]">Máximo 2000 caracteres.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-primary)]">Sua foto (opcional)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={onPhotoChange}
                  className="theme-input mt-1 w-full rounded border border-[var(--igh-border)] bg-[var(--card-bg)] text-sm text-[var(--text-primary)] file:mr-2 file:rounded file:border-0 file:bg-[var(--igh-primary)] file:px-3 file:py-1.5 file:text-white file:text-sm"
                />
                <p className="mt-1 text-xs text-[var(--text-muted)]">JPEG, PNG ou WebP. Máximo 5MB.</p>
                {photoPreview && (
                  <div className="mt-2">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="h-20 w-20 rounded-full object-cover border border-[var(--igh-border)]"
                    />
                  </div>
                )}
              </div>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Enviando..." : "Enviar depoimento"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </Section>
  );
}
