"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";

const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

type StudentProfile = {
  id: string;
  name: string;
  birthDate: string;
  cpf: string;
  rg: string;
  email: string | null;
  phone: string;
  cep: string | null;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  gender: string;
  hasDisability: boolean;
  disabilityDescription: string | null;
  educationLevel: string;
  isStudying: boolean;
  studyShift: string | null;
  guardianName: string | null;
  guardianCpf: string | null;
  guardianRg: string | null;
  guardianPhone: string | null;
  guardianRelationship: string | null;
};

type Attachment = {
  id: string;
  type: string;
  url: string;
  fileName: string | null;
};

const GENDER_OPTIONS = [
  { value: "MALE", label: "Masculino" },
  { value: "FEMALE", label: "Feminino" },
  { value: "OTHER", label: "Outro" },
  { value: "PREFER_NOT_SAY", label: "Prefiro não dizer" },
];

const EDUCATION_OPTIONS = [
  { value: "NONE", label: "Nenhuma" },
  { value: "ELEMENTARY_INCOMPLETE", label: "Fundamental incompleto" },
  { value: "ELEMENTARY_COMPLETE", label: "Fundamental completo" },
  { value: "HIGH_INCOMPLETE", label: "Médio incompleto" },
  { value: "HIGH_COMPLETE", label: "Médio completo" },
  { value: "COLLEGE_INCOMPLETE", label: "Superior incompleto" },
  { value: "COLLEGE_COMPLETE", label: "Superior completo" },
  { value: "OTHER", label: "Outro" },
];

function onlyDigits(v: string, max?: number): string {
  const d = v.replace(/\D/g, "");
  return max != null ? d.slice(0, max) : d;
}
function formatCpf(v: string): string {
  const d = onlyDigits(v, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}
function formatPhone(v: string): string {
  const d = onlyDigits(v, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}
function formatCep(v: string): string {
  const d = onlyDigits(v, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5, 8)}`;
}

export function MeusDadosForm() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [form, setForm] = useState<Record<string, string | boolean | null>>({});
  const [uploadingType, setUploadingType] = useState<"ID_DOCUMENT" | "ADDRESS_PROOF" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, attRes] = await Promise.all([
        fetch("/api/me/student/profile"),
        fetch("/api/me/student/attachments"),
      ]);
      const profileJson = (await profileRes.json()) as ApiResponse<{ student: StudentProfile }>;
      const attJson = (await attRes.json()) as ApiResponse<{ attachments: Attachment[] }>;
      if (profileJson?.ok && profileJson.data.student) {
        const s = profileJson.data.student;
        setProfile(s);
        setForm({
          name: s.name,
          birthDate: s.birthDate ? s.birthDate.toString().slice(0, 10) : "",
          cpf: s.cpf,
          rg: s.rg ?? "",
          email: s.email ?? "",
          phone: s.phone,
          cep: s.cep ?? "",
          street: s.street ?? "",
          number: s.number ?? "",
          complement: s.complement ?? "",
          neighborhood: s.neighborhood ?? "",
          city: s.city ?? "",
          state: s.state ?? "",
          gender: s.gender,
          hasDisability: s.hasDisability,
          disabilityDescription: s.disabilityDescription ?? "",
          educationLevel: s.educationLevel,
          isStudying: s.isStudying,
          studyShift: s.studyShift ?? "",
          guardianName: s.guardianName ?? "",
          guardianCpf: s.guardianCpf ?? "",
          guardianRg: s.guardianRg ?? "",
          guardianPhone: s.guardianPhone ?? "",
          guardianRelationship: s.guardianRelationship ?? "",
        });
      }
      if (attJson?.ok && attJson.data.attachments) setAttachments(attJson.data.attachments);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/me/student", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.name ?? "").trim(),
          birthDate: form.birthDate || undefined,
          cpf: form.cpf ? onlyDigits(String(form.cpf), 11) : undefined,
          rg: String(form.rg ?? "").trim() || undefined,
          email: String(form.email ?? "").trim() || undefined,
          phone: form.phone ? onlyDigits(String(form.phone), 11) : undefined,
          cep: form.cep ? onlyDigits(String(form.cep), 8) : undefined,
          street: String(form.street ?? "").trim(),
          number: String(form.number ?? "").trim(),
          complement: String(form.complement ?? "").trim() || undefined,
          neighborhood: String(form.neighborhood ?? "").trim(),
          city: String(form.city ?? "").trim(),
          state: String(form.state ?? "").trim().toUpperCase().slice(0, 2),
          gender: form.gender,
          hasDisability: !!form.hasDisability,
          disabilityDescription: form.hasDisability ? String(form.disabilityDescription ?? "").trim() || undefined : undefined,
          educationLevel: form.educationLevel,
          isStudying: !!form.isStudying,
          studyShift: form.isStudying ? (form.studyShift || undefined) : undefined,
          guardianName: String(form.guardianName ?? "").trim() || undefined,
          guardianCpf: form.guardianCpf ? onlyDigits(String(form.guardianCpf), 11) : undefined,
          guardianRg: String(form.guardianRg ?? "").trim() || undefined,
          guardianPhone: form.guardianPhone ? onlyDigits(String(form.guardianPhone), 11) : undefined,
          guardianRelationship: String(form.guardianRelationship ?? "").trim() || undefined,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ student: unknown }>;
      if (!res.ok || !json?.ok) {
        toast.push("error", json && !json.ok && "error" in json ? json.error.message : "Falha ao salvar.");
        return;
      }
      toast.push("success", "Dados salvos.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAttachment(type: "ID_DOCUMENT" | "ADDRESS_PROOF", file: File): Promise<boolean> {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.push("error", "Aceito apenas PDF, JPG ou PNG.");
      return false;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.push("error", "Arquivo deve ter no máximo 5MB.");
      return false;
    }
    setUploadingType(type);
    try {
      const signRes = await fetch("/api/me/uploads/cloudinary-signature", { method: "POST" });
      const signJson = (await signRes.json()) as ApiResponse<{
        timestamp: number;
        signature: string;
        apiKey: string;
        cloudName: string;
        folder: string;
      }>;
      if (!signRes.ok || !signJson?.ok) {
        toast.push("error", "Falha ao obter permissão de upload.");
        return false;
      }
      const { timestamp, signature, apiKey, cloudName, folder } = signJson.data;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", apiKey);
      formData.append("timestamp", String(timestamp));
      formData.append("signature", signature);
      formData.append("folder", folder);
      const uploadRes = await fetch(`${CLOUDINARY_UPLOAD_URL}/${cloudName}/auto/upload`, {
        method: "POST",
        body: formData,
      });
      const cloudResult = (await uploadRes.json()) as {
        secure_url?: string;
        public_id?: string;
        bytes?: number;
        original_filename?: string;
        error?: { message?: string };
      };
      if (!uploadRes.ok || !cloudResult.secure_url || !cloudResult.public_id) {
        toast.push("error", cloudResult?.error?.message ?? "Falha no upload.");
        return false;
      }
      const metaRes = await fetch("/api/me/student/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          publicId: cloudResult.public_id,
          url: cloudResult.secure_url,
          fileName: cloudResult.original_filename ?? file.name,
          mimeType: file.type,
          sizeBytes: cloudResult.bytes ?? file.size,
        }),
      });
      if (!metaRes.ok) {
        toast.push("error", "Falha ao registrar anexo.");
        return false;
      }
      toast.push("success", type === "ID_DOCUMENT" ? "Documento de identidade enviado." : "Comprovante de residência enviado.");
      void load();
      return true;
    } finally {
      setUploadingType(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] py-10 text-center text-[var(--text-secondary)]" role="status">
        Carregando seus dados...
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-10 text-center" role="status">
        <p className="text-sm text-[var(--text-muted)]">Cadastro não encontrado.</p>
      </div>
    );
  }

  const idDoc = attachments.find((a) => a.type === "ID_DOCUMENT");
  const addressProof = attachments.find((a) => a.type === "ADDRESS_PROOF");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 sm:p-5" role="region" aria-labelledby="identificacao-heading">
        <h2 id="identificacao-heading" className="mb-4 text-base font-semibold text-[var(--text-primary)]">Identificação</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Nome</label>
            <Input
              className="mt-1"
              value={String(form.name ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">CPF</label>
            <Input
              className="mt-1"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={String(form.cpf ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, cpf: formatCpf(e.target.value) }))}
              maxLength={14}
            />
          </div>
          <div>
            <label className="text-sm font-medium">RG</label>
            <Input
              className="mt-1"
              value={String(form.rg ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, rg: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Data de nascimento</label>
            <Input
              className="mt-1"
              type="date"
              value={String(form.birthDate ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">E-mail</label>
            <Input
              className="mt-1"
              type="email"
              value={String(form.email ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Telefone</label>
            <Input
              className="mt-1"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={String(form.phone ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))}
              maxLength={15}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Gênero</label>
            <select
              className="theme-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={String(form.gender ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
            >
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Escolaridade</label>
            <select
              className="theme-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={String(form.educationLevel ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, educationLevel: e.target.value }))}
            >
              {EDUCATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 sm:p-5" role="region" aria-labelledby="responsavel-heading">
        <h2 id="responsavel-heading" className="mb-4 text-base font-semibold text-[var(--text-primary)]">Responsável (menores de 18 anos)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Nome do responsável</label>
            <Input className="mt-1" value={String(form.guardianName ?? "")} onChange={(e) => setForm((f) => ({ ...f, guardianName: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium">CPF do responsável</label>
            <Input className="mt-1" type="text" inputMode="numeric" autoComplete="off" value={String(form.guardianCpf ?? "")} onChange={(e) => setForm((f) => ({ ...f, guardianCpf: formatCpf(e.target.value) }))} maxLength={14} />
          </div>
          <div>
            <label className="text-sm font-medium">RG do responsável</label>
            <Input className="mt-1" value={String(form.guardianRg ?? "")} onChange={(e) => setForm((f) => ({ ...f, guardianRg: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium">Telefone do responsável</label>
            <Input className="mt-1" type="tel" inputMode="numeric" autoComplete="tel" value={String(form.guardianPhone ?? "")} onChange={(e) => setForm((f) => ({ ...f, guardianPhone: formatPhone(e.target.value) }))} maxLength={15} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Parentesco</label>
            <Input className="mt-1" value={String(form.guardianRelationship ?? "")} onChange={(e) => setForm((f) => ({ ...f, guardianRelationship: e.target.value }))} placeholder="Ex.: pai, mãe" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 sm:p-5" role="region" aria-labelledby="endereco-heading">
        <h2 id="endereco-heading" className="mb-4 text-base font-semibold text-[var(--text-primary)]">Endereço</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">CEP</label>
            <Input
              className="mt-1"
              value={String(form.cep ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, cep: formatCep(e.target.value) }))}
              maxLength={9}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Rua</label>
            <Input
              className="mt-1"
              value={String(form.street ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Número</label>
            <Input
              className="mt-1"
              value={String(form.number ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Complemento</label>
            <Input
              className="mt-1"
              value={String(form.complement ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, complement: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Bairro</label>
            <Input
              className="mt-1"
              value={String(form.neighborhood ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Cidade</label>
            <Input
              className="mt-1"
              value={String(form.city ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">UF</label>
            <Input
              className="mt-1 w-20"
              value={String(form.state ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))}
              maxLength={2}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 sm:p-5" role="region" aria-labelledby="anexos-heading">
        <h2 id="anexos-heading" className="mb-4 text-base font-semibold text-[var(--text-primary)]">Anexos</h2>
        <p className="mb-4 text-xs text-[var(--text-muted)]">Envie documento de identidade (RG ou CPF) e comprovante de residência (PDF ou imagem, máx. 5MB).</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Documento de identidade</label>
            {idDoc ? (
              <div className="mt-1">
                <a href={idDoc.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--igh-primary)] underline hover:no-underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded">
                  {idDoc.fileName ?? "Ver arquivo"}
                </a>
                <span className="ml-2 text-xs text-[var(--text-muted)]">— envie outro para substituir</span>
              </div>
            ) : null}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="mt-1 block w-full text-sm"
              disabled={uploadingType === "ID_DOCUMENT"}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAttachment("ID_DOCUMENT", f);
                e.target.value = "";
              }}
            />
            {uploadingType === "ID_DOCUMENT" && <span className="text-xs text-[var(--text-muted)]">Enviando…</span>}
          </div>
          <div>
            <label className="text-sm font-medium">Comprovante de residência</label>
            {addressProof ? (
              <div className="mt-1">
                <a href={addressProof.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--igh-primary)] underline hover:no-underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded">
                  {addressProof.fileName ?? "Ver arquivo"}
                </a>
                <span className="ml-2 text-xs text-[var(--text-muted)]">— envie outro para substituir</span>
              </div>
            ) : null}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="mt-1 block w-full text-sm"
              disabled={uploadingType === "ADDRESS_PROOF"}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAttachment("ADDRESS_PROOF", f);
                e.target.value = "";
              }}
            />
            {uploadingType === "ADDRESS_PROOF" && <span className="text-xs text-[var(--text-muted)]">Enviando…</span>}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={saving}
          className="rounded-lg focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
        >
          {saving ? "Salvando..." : "Salvar dados"}
        </Button>
      </div>
    </form>
  );
}
