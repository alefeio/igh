"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardHero, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { StudentForm } from "@/components/students/StudentForm";
import type { StudentFormStudent } from "@/components/students/StudentForm";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import { formatDateOnly } from "@/lib/format";
import { AlertCircle } from "lucide-react";

function formatCpf(v: string): string {
  const d = v.replace(/\D/g, "");
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

function formatPhone(v: string): string {
  const d = v.replace(/\D/g, "");
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

/** Retorna URL do WhatsApp (wa.me) para o número; assume Brasil (55) se tiver 10–11 dígitos. */
function whatsappUrl(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 10) return "#";
  const full = d.length === 11 ? `55${d}` : d.length === 10 ? `55${d}` : `55${d.slice(-11)}`;
  return `https://wa.me/${full}`;
}

const GENDER_LABELS: Record<string, string> = {
  MALE: "Masculino",
  FEMALE: "Feminino",
  OTHER: "Outro",
  PREFER_NOT_SAY: "Prefiro não dizer",
};
const EDUCATION_LEVEL_LABELS: Record<string, string> = {
  NONE: "Nenhuma",
  ELEMENTARY_INCOMPLETE: "Fundamental incompleto",
  ELEMENTARY_COMPLETE: "Fundamental completo",
  HIGH_INCOMPLETE: "Médio incompleto",
  HIGH_COMPLETE: "Médio completo",
  COLLEGE_INCOMPLETE: "Superior incompleto",
  COLLEGE_COMPLETE: "Superior completo",
  OTHER: "Outro",
};
const STUDY_SHIFT_LABELS: Record<string, string> = {
  MORNING: "Manhã",
  AFTERNOON: "Tarde",
  EVENING: "Noite",
  FULL: "Integral",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="font-medium text-[var(--text-muted)]">{label}</span>
      <br />
      {value ?? "—"}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--card-border)] pb-3 last:border-b-0 last:pb-0">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{title}</h3>
      <div className="grid gap-2 text-sm sm:grid-cols-2">{children}</div>
    </div>
  );
}

type StudentAttachmentView = {
  id: string;
  type: "ID_DOCUMENT" | "ADDRESS_PROOF";
  fileName: string | null;
  url: string;
  createdAt: string | null;
};

type Student = StudentFormStudent & {
  deletedAt: string | null;
  createdAt: string;
  hasIdDocument?: boolean;
  hasAddressProof?: boolean;
  attachments?: StudentAttachmentView[];
  userId?: string | null;
};

/** Amarelo = só documentos faltando; vermelho = dados incompletos e documentos faltando. */
function documentationAlert(s: Student): "yellow" | "red" | null {
  const hasId = s.hasIdDocument === true;
  const hasAddr = s.hasAddressProof === true;
  if (hasId && hasAddr) return null;
  const nameOk = (s.name ?? "").trim().length > 0;
  const cpfOk = (s.cpf ?? "").replace(/\D/g, "").length === 11;
  const phoneOk = (s.phone ?? "").replace(/\D/g, "").length >= 10;
  const birthOk = !!s.birthDate;
  const streetOk = (s.street ?? "").trim().length > 0;
  const numberOk = (s.number ?? "").trim().length > 0;
  const cityOk = (s.city ?? "").trim().length > 0;
  const stateOk = (s.state ?? "").trim().length > 0;
  const dataComplete = nameOk && cpfOk && phoneOk && birthOk && streetOk && numberOk && cityOk && stateOk;
  if (!hasId || !hasAddr) return dataComplete ? "yellow" : "red";
  return "yellow";
}

export default function StudentsPage() {
  const toast = useToast();
  const user = useUser();
  const isMaster = user.role === "MASTER";
  const isTeacher = user.role === "TEACHER";

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Student[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [changePasswordStudent, setChangePasswordStudent] = useState<Student | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [q, setQ] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const canChangePassword = (user.role === "ADMIN" || user.role === "MASTER") && !isTeacher;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (isMaster && includeDeleted) params.set("includeDeleted", "true");
      const res = await fetch(`/api/students?${params.toString()}`);
      const json = (await res.json()) as ApiResponse<{ students: Student[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar alunos.");
        return;
      }
      setItems(json.data.students);
    } finally {
      setLoading(false);
    }
  }, [q, isMaster, includeDeleted, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    setOpen(true);
  }

  async function openView(s: Student) {
    setViewingStudent(s);
    setViewLoading(true);
    try {
      const res = await fetch(`/api/students/${s.id}`);
      const json = (await res.json()) as ApiResponse<{ student: Student }>;
      if (res.ok && json.ok) setViewingStudent(json.data.student as Student);
      else toast.push("error", !json.ok ? json.error.message : "Falha ao carregar dados do aluno.");
    } finally {
      setViewLoading(false);
    }
  }

  async function softDelete(s: Student) {
    if (!confirm(`Excluir o aluno "${s.name}"? (exclusão lógica; apenas MASTER pode reativar.)`)) return;
    const res = await fetch(`/api/students/${s.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ student: Student }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Aluno excluído.");
    await load();
  }

  async function reactivate(s: Student) {
    const res = await fetch(`/api/students/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reactivate: true }),
    });
    const json = (await res.json()) as ApiResponse<{ student: Student }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao reativar.");
      return;
    }
    toast.push("success", "Aluno reativado.");
    await load();
  }

  async function permanentDelete(s: Student) {
    if (!confirm(`Excluir definitivamente o aluno "${s.name}"? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/students/${s.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted?: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Aluno excluído definitivamente.");
    await load();
  }

  function openChangePassword(s: Student) {
    setChangePasswordStudent(s);
    setNewPassword("");
    setConfirmPassword("");
  }

  async function submitChangePassword(e: React.FormEvent) {
    e.preventDefault();
    const s = changePasswordStudent;
    if (!s?.userId) {
      toast.push("error", "Este aluno não possui conta de acesso (e-mail vinculado).");
      return;
    }
    if (newPassword.length < 8) {
      toast.push("error", "A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.push("error", "As senhas não coincidem.");
      return;
    }
    setChangePasswordLoading(true);
    try {
      const res = await fetch(`/api/students/${s.id}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const json = (await res.json()) as ApiResponse<{ message?: string }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error?.message ?? "Falha ao alterar senha." : "Falha ao alterar senha.");
        return;
      }
      toast.push("success", "Senha alterada com sucesso.");
      setChangePasswordStudent(null);
    } finally {
      setChangePasswordLoading(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <DashboardHero
        eyebrow={isTeacher ? "Professor" : "Cadastros"}
        title="Alunos"
        description={
          isTeacher
            ? "Alunos matriculados nas turmas que você leciona. Use a busca por nome ou CPF."
            : "Cadastro base do aluno. Use a busca por nome ou CPF."
        }
        rightSlot={
          !isTeacher ? (
            <Button onClick={openCreate} className="w-full sm:w-auto">
              Novo aluno
            </Button>
          ) : undefined
        }
      />

      <SectionCard
        title="Busca"
        description="Filtre a listagem por nome ou CPF."
        variant="elevated"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar por nome ou CPF"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          {isMaster && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
              />
              Incluir excluídos
            </label>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Listagem"
        description={
          loading
            ? "Carregando alunos…"
            : `${items.length} ${items.length === 1 ? "registro" : "registros"} exibidos.`
        }
        variant="elevated"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-14" role="status">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-[var(--igh-primary)]/20" aria-hidden />
            <p className="mt-3 text-sm text-[var(--text-muted)]">Carregando…</p>
          </div>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>CPF</Th>
                <Th>Celular</Th>
                <Th>E-mail</Th>
                <Th className="w-10 text-center" title="Documentação">
                  Doc.
                </Th>
                <Th />
              </tr>
            </thead>
            <tbody>
            {items.map((s) => {
              const docAlert = documentationAlert(s);
              return (
              <tr key={s.id}>
                <Td>
                  <span className={s.deletedAt ? "text-[var(--text-muted)] line-through" : ""}>{s.name}</span>
                  {s.deletedAt && (
                    <span className="ml-1"><Badge tone="red">Excluído</Badge></span>
                  )}
                </Td>
                <Td>{formatCpf(s.cpf)}</Td>
                <Td>{formatPhone(s.phone)}</Td>
                <Td>{s.email ?? "—"}</Td>
                <Td className="text-center">
                  {docAlert && (
                    <span
                      title={docAlert === "red" ? "Dados incompletos e documentação faltando" : "Documentação incompleta (identidade e/ou comprovante de residência)"}
                      className="inline-flex"
                    >
                      <AlertCircle
                        className={`h-5 w-5 ${docAlert === "red" ? "text-red-600" : "text-amber-500"}`}
                        aria-hidden
                      />
                    </span>
                  )}
                </Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => openView(s)}>
                      Visualizar
                    </Button>
                    {!isTeacher && (
                      <>
                        {!s.deletedAt && (
                          <Button variant="secondary" onClick={() => openEdit(s)}>
                            Editar
                          </Button>
                        )}
                        {isMaster && (
                          s.deletedAt ? (
                            <>
                              <Button variant="secondary" onClick={() => reactivate(s)}>
                                Reativar
                              </Button>
                              <Button
                                variant="secondary"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => permanentDelete(s)}
                              >
                                Excluir definitivamente
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="secondary"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => softDelete(s)}
                            >
                              Excluir
                            </Button>
                          )
                        )}
                      </>
                    )}
                  </div>
                </Td>
              </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <Td colSpan={6} className="text-[var(--text-secondary)]">
                  Nenhum aluno encontrado.
                </Td>
              </tr>
            )}
          </tbody>
          </TableShell>
        )}
      </SectionCard>

      <Modal
        open={open}
        title={editing ? "Editar aluno" : "Novo aluno"}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      >
        <StudentForm
          editing={editing}
          onSuccess={() => {
            setOpen(false);
            setEditing(null);
            void load();
          }}
          onCancel={() => {
            setOpen(false);
            setEditing(null);
          }}
          isMaster={isMaster}
        />
      </Modal>

      <Modal
        open={viewingStudent !== null}
        title="Dados do aluno"
        onClose={() => setViewingStudent(null)}
      >
        {viewLoading ? (
          <div className="text-sm text-[var(--text-secondary)]">Carregando...</div>
        ) : viewingStudent ? (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1 text-sm">
            <Section title="Dados pessoais">
              <Field label="Nome" value={viewingStudent.name} />
              <Field label="CPF" value={formatCpf(viewingStudent.cpf)} />
              <Field label="RG" value={viewingStudent.rg || "—"} />
              <Field label="Data de nascimento" value={viewingStudent.birthDate ? formatDateOnly(viewingStudent.birthDate) : "—"} />
              <Field label="Gênero" value={GENDER_LABELS[viewingStudent.gender] ?? viewingStudent.gender} />
              <div>
                <span className="font-medium text-[var(--text-muted)]">Celular</span>
                <br />
                <span className="inline-flex flex-wrap items-center gap-2">
                  {formatPhone(viewingStudent.phone)}
                  {viewingStudent.phone?.replace(/\D/g, "").length >= 10 && (
                    <a
                      href={whatsappUrl(viewingStudent.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-[var(--igh-primary)] px-2 py-1 text-xs font-medium text-white hover:opacity-90"
                      title="Abrir no WhatsApp"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WhatsApp
                    </a>
                  )}
                </span>
              </div>
              <Field label="E-mail" value={viewingStudent.email} />
            </Section>

            <Section title="Endereço">
              <Field label="CEP" value={viewingStudent.cep ? viewingStudent.cep.replace(/(\d{5})(\d{3})/, "$1-$2") : "—"} />
              <Field label="Rua" value={viewingStudent.street || "—"} />
              <Field label="Número" value={viewingStudent.number || "—"} />
              <Field label="Complemento" value={viewingStudent.complement} />
              <Field label="Bairro" value={viewingStudent.neighborhood || "—"} />
              <Field label="Cidade" value={viewingStudent.city || "—"} />
              <Field label="Estado" value={viewingStudent.state || "—"} />
            </Section>

            <Section title="Escolaridade">
              <Field label="Escolaridade" value={EDUCATION_LEVEL_LABELS[viewingStudent.educationLevel] ?? viewingStudent.educationLevel} />
              <Field label="Está estudando?" value={viewingStudent.isStudying ? "Sim" : "Não"} />
              {viewingStudent.isStudying && viewingStudent.studyShift && (
                <Field label="Turno" value={STUDY_SHIFT_LABELS[viewingStudent.studyShift] ?? viewingStudent.studyShift} />
              )}
            </Section>

            {(viewingStudent.hasDisability || viewingStudent.disabilityDescription) && (
              <Section title="Deficiência">
                <Field label="Possui deficiência?" value={viewingStudent.hasDisability ? "Sim" : "Não"} />
                {viewingStudent.hasDisability && (
                  <Field label="Descrição" value={viewingStudent.disabilityDescription} />
                )}
              </Section>
            )}

            {(viewingStudent.guardianName || viewingStudent.guardianPhone) && (
              <Section title="Responsável (menor de 18 anos)">
                <Field label="Nome do responsável" value={viewingStudent.guardianName} />
                <Field label="CPF do responsável" value={viewingStudent.guardianCpf ? formatCpf(viewingStudent.guardianCpf) : "—"} />
                <Field label="RG do responsável" value={viewingStudent.guardianRg} />
                <Field label="Telefone do responsável" value={viewingStudent.guardianPhone ? formatPhone(viewingStudent.guardianPhone) : "—"} />
                <Field label="Parentesco" value={viewingStudent.guardianRelationship} />
              </Section>
            )}

            <Section title="Documentação">
              {(() => {
                const attachments = viewingStudent.attachments ?? [];
                const idDoc = attachments.find((a) => a.type === "ID_DOCUMENT");
                const addressProof = attachments.find((a) => a.type === "ADDRESS_PROOF");
                return (
                  <>
                    <div>
                      <span className="font-medium text-[var(--text-muted)]">Documento de identidade</span>
                      <br />
                      {idDoc ? (
                        <a href={idDoc.url} target="_blank" rel="noopener noreferrer" className="text-[var(--igh-primary)] hover:underline">
                          {idDoc.fileName || "Documento enviado"} ↗
                        </a>
                      ) : (
                        <span className="text-[var(--text-muted)]">Não enviado</span>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-[var(--text-muted)]">Comprovante de residência</span>
                      <br />
                      {addressProof ? (
                        <a href={addressProof.url} target="_blank" rel="noopener noreferrer" className="text-[var(--igh-primary)] hover:underline">
                          {addressProof.fileName || "Comprovante enviado"} ↗
                        </a>
                      ) : (
                        <span className="text-[var(--text-muted)]">Não enviado</span>
                      )}
                    </div>
                  </>
                );
              })()}
            </Section>

            {canChangePassword && viewingStudent.userId && (
              <Section title="Acesso">
                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => openChangePassword(viewingStudent)}
                  >
                    Alterar senha do usuário
                  </Button>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Define uma nova senha para o login deste aluno no sistema.
                  </p>
                </div>
              </Section>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={changePasswordStudent !== null}
        title="Alterar senha do usuário"
        onClose={() => {
          setChangePasswordStudent(null);
          setNewPassword("");
          setConfirmPassword("");
        }}
      >
        {changePasswordStudent && (
          <form onSubmit={submitChangePassword} className="flex flex-col gap-4">
            <p className="text-sm text-[var(--text-muted)]">
              Altere a senha de acesso de <strong>{changePasswordStudent.name}</strong>. O aluno precisará usar a nova senha no próximo login.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Nova senha *
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Confirmar nova senha *
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={changePasswordLoading}>
                {changePasswordLoading ? "Alterando..." : "Alterar senha"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setChangePasswordStudent(null);
                  setNewPassword("");
                  setConfirmPassword("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
