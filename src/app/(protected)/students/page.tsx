"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

const GENDER_LABELS: Record<string, string> = {
  MALE: "Masculino",
  FEMALE: "Feminino",
  OTHER: "Outro",
  PREFER_NOT_SAY: "Prefiro não dizer",
};

const STUDY_SHIFT_LABELS: Record<string, string> = {
  MORNING: "Manhã",
  AFTERNOON: "Tarde",
  EVENING: "Noite",
  FULL: "Integral",
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

type Student = {
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
  deletedAt: string | null;
  createdAt: string;
};

type StudentAttachment = {
  id: string;
  studentId: string;
  type: "ID_DOCUMENT" | "ADDRESS_PROOF";
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  publicId: string;
  url: string;
  createdAt: string;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1";

function onlyDigits(v: string, maxLength?: number): string {
  const d = v.replace(/\D/g, "");
  return maxLength != null ? d.slice(0, maxLength) : d;
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

/** Primeira letra de cada palavra em maiúscula, restante em minúscula */
function toTitleCase(value: string): string {
  if (!value || value.trim() === "") return value;
  return value
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
    .join(" ");
}

/** Valida CPF por tamanho (11 dígitos) e dígitos verificadores */
function isValidCPF(cpf: string): boolean {
  const d = onlyDigits(cpf, 11);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false; // todos iguais
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i], 10) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(d[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i], 10) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(d[10], 10);
}

export default function StudentsPage() {
  const toast = useToast();
  const user = useUser();
  const isMaster = user.role === "MASTER";

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Student[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [q, setQ] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("Belém");
  const [state, setState] = useState("PA");
  const [loadingCep, setLoadingCep] = useState(false);
  const [gender, setGender] = useState<Student["gender"]>("MALE");
  const [hasDisability, setHasDisability] = useState(false);
  const [disabilityDescription, setDisabilityDescription] = useState("");
  const [educationLevel, setEducationLevel] = useState<Student["educationLevel"]>("NONE");
  const [isStudying, setIsStudying] = useState(false);
  const [studyShift, setStudyShift] = useState<Student["studyShift"]>(null);
  const [guardianName, setGuardianName] = useState("");
  const [guardianCpf, setGuardianCpf] = useState("");
  const [guardianRg, setGuardianRg] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [attachments, setAttachments] = useState<StudentAttachment[]>([]);
  const [uploadingType, setUploadingType] = useState<"ID_DOCUMENT" | "ADDRESS_PROOF" | null>(null);
  /** Arquivos selecionados no cadastro (antes de ter studentId); enviados após criar o aluno */
  const [pendingIdDocument, setPendingIdDocument] = useState<File | null>(null);
  const [pendingAddressProof, setPendingAddressProof] = useState<File | null>(null);

  const isMinor = useMemo(() => {
    if (!birthDate) return false;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age < 18;
  }, [birthDate]);

  const cpfDigits = useMemo(() => onlyDigits(cpf, 11), [cpf]);
  const cpfInvalid = cpfDigits.length === 11 && !isValidCPF(cpf);

  const canSubmit = useMemo(() => {
    if (name.trim().length < 2) return false;
    if (!birthDate) return false;
    if (cpfDigits.length !== 11 || !isValidCPF(cpf)) return false;
    if (rg.trim().length < 1) return false;
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) return false;
    if (street.trim().length < 1) return false;
    if (number.trim().length < 1) return false;
    if (neighborhood.trim().length < 1) return false;
    if (city.trim().length < 1) return false;
    if (state.trim().length !== 2) return false;
    if (hasDisability && (disabilityDescription?.trim().length ?? 0) < 3) return false;
    if (isStudying && !studyShift) return false;
    if (isMinor) {
      if ((guardianName?.trim().length ?? 0) < 2) return false;
      if ((guardianCpf?.replace(/\D/g, "")?.length ?? 0) !== 11) return false;
      if ((guardianPhone?.replace(/\D/g, "")?.length ?? 0) < 10) return false;
      if ((guardianRelationship?.trim().length ?? 0) < 1) return false;
    }
    return true;
  }, [
    name,
    birthDate,
    cpfDigits,
    cpf,
    rg,
    phone,
    street,
    number,
    neighborhood,
    city,
    state,
    hasDisability,
    disabilityDescription,
    isStudying,
    studyShift,
    isMinor,
    guardianName,
    guardianCpf,
    guardianPhone,
    guardianRelationship,
  ]);

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

  function resetForm() {
    setName("");
    setBirthDate("");
    setCpf("");
    setRg("");
    setEmail("");
    setPhone("");
    setCep("");
    setStreet("");
    setNumber("");
    setComplement("");
    setNeighborhood("");
    setCity("Belém");
    setState("PA");
    setGender("MALE");
    setHasDisability(false);
    setDisabilityDescription("");
    setEducationLevel("NONE");
    setIsStudying(false);
    setStudyShift(null);
    setGuardianName("");
    setGuardianCpf("");
    setGuardianRg("");
    setGuardianPhone("");
    setGuardianRelationship("");
    setEditing(null);
    setAttachments([]);
    setPendingIdDocument(null);
    setPendingAddressProof(null);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  async function loadAttachments(studentId: string) {
    try {
      const res = await fetch(`/api/students/${studentId}/attachments`);
      const json = (await res.json()) as ApiResponse<{ attachments: StudentAttachment[] }>;
      if (res.ok && json.ok) setAttachments(json.data.attachments);
      else setAttachments([]);
    } catch {
      setAttachments([]);
    }
  }

  function openEdit(s: Student) {
    setEditing(s);
    setName(s.name);
    setBirthDate(s.birthDate.slice(0, 10));
    setCpf(formatCpf(s.cpf));
    setRg(s.rg);
    setEmail(s.email ?? "");
    setPhone(formatPhone(s.phone));
    setCep(s.cep ? formatCep(s.cep) : "");
    setStreet(s.street);
    setNumber(s.number);
    setComplement(s.complement ?? "");
    setNeighborhood(s.neighborhood);
    setCity(s.city);
    setState(s.state);
    setGender(s.gender);
    setHasDisability(s.hasDisability);
    setDisabilityDescription(s.disabilityDescription ?? "");
    setEducationLevel(s.educationLevel);
    setIsStudying(s.isStudying);
    setStudyShift(s.studyShift);
    setGuardianName(s.guardianName ?? "");
    setGuardianCpf(s.guardianCpf ? formatCpf(s.guardianCpf) : "");
    setGuardianRg(s.guardianRg ?? "");
    setGuardianPhone(s.guardianPhone ? formatPhone(s.guardianPhone) : "");
    setGuardianRelationship(s.guardianRelationship ?? "");
    setAttachments([]);
    setOpen(true);
    void loadAttachments(s.id);
  }

  function buildPayload() {
    return {
      name: name.trim(),
      birthDate: birthDate.slice(0, 10),
      cpf: cpf.replace(/\D/g, ""),
      rg: rg.trim(),
      email: email.trim() || undefined,
      phone: phone.replace(/\D/g, ""),
      cep: cep.replace(/\D/g, "") || undefined,
      street: street.trim(),
      number: number.trim(),
      complement: complement.trim() || undefined,
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase().slice(0, 2),
      gender,
      hasDisability,
      disabilityDescription: hasDisability ? disabilityDescription.trim() || undefined : undefined,
      educationLevel,
      isStudying,
      studyShift: isStudying ? studyShift ?? undefined : undefined,
      guardianName: guardianName.trim() || undefined,
      guardianCpf: guardianCpf.replace(/\D/g, "") || undefined,
      guardianRg: guardianRg.trim() || undefined,
      guardianPhone: guardianPhone.replace(/\D/g, "") || undefined,
      guardianRelationship: guardianRelationship.trim() || undefined,
    };
  }

  /** Faz upload de um arquivo para o aluno (assinatura → Cloudinary → POST metadata) */
  async function uploadAttachmentForStudent(
    studentId: string,
    type: "ID_DOCUMENT" | "ADDRESS_PROOF",
    file: File
  ): Promise<boolean> {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.push("error", "Aceito apenas PDF, JPG ou PNG.");
      return false;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.push("error", "Arquivo deve ter no máximo 5MB.");
      return false;
    }
    const signRes = await fetch("/api/uploads/cloudinary-signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, attachmentType: type }),
    });
    const signJson = (await signRes.json()) as ApiResponse<{
      timestamp: number;
      signature: string;
      apiKey: string;
      cloudName: string;
      folder: string;
    }>;
    if (!signRes.ok || !signJson.ok) {
      toast.push("error", (signJson as { error?: { message?: string } }).error?.message ?? "Falha ao obter permissão de upload.");
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
    const metaRes = await fetch(`/api/students/${studentId}/attachments`, {
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
    const metaJson = (await metaRes.json()) as ApiResponse<{ attachment: StudentAttachment }>;
    if (!metaRes.ok || !metaJson.ok) {
      toast.push("error", (metaJson as { error?: { message?: string } }).error?.message ?? "Falha ao registrar anexo.");
      return false;
    }
    return true;
  }

  async function fetchAddressByCep() {
    const cepDigits = cep.replace(/\D/g, "");
    if (cepDigits.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
      const data = (await res.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro || !data.logradouro) {
        toast.push("error", "CEP não encontrado. Verifique o número ou preencha o endereço manualmente.");
        return;
      }
      setStreet(data.logradouro ?? "");
      setNeighborhood(data.bairro ?? "");
      setCity(data.localidade ?? "");
      setState(data.uf ?? "");
      toast.push("success", "Endereço preenchido automaticamente.");
    } catch {
      toast.push("error", "Não foi possível buscar o CEP. Preencha o endereço manualmente.");
    } finally {
      setLoadingCep(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (cpfInvalid) {
      toast.push("error", "CPF inválido. Verifique os dígitos.");
      return;
    }

    const payload = buildPayload();
    const url = editing ? `/api/students/${editing.id}` : "/api/students";
    const method = editing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as ApiResponse<{ student: Student }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao salvar aluno.");
      return;
    }

    const createdStudent = json.data.student;

    if (!editing && (pendingIdDocument || pendingAddressProof)) {
      setUploadingType("ID_DOCUMENT");
      try {
        if (pendingIdDocument) {
          const ok = await uploadAttachmentForStudent(createdStudent.id, "ID_DOCUMENT", pendingIdDocument);
          if (!ok) return;
        }
        if (pendingAddressProof) {
          setUploadingType("ADDRESS_PROOF");
          const ok = await uploadAttachmentForStudent(createdStudent.id, "ADDRESS_PROOF", pendingAddressProof);
          if (!ok) return;
        }
      } finally {
        setUploadingType(null);
      }
    }

    toast.push("success", editing ? "Aluno atualizado." : "Aluno criado.");
    setOpen(false);
    resetForm();
    await load();
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

  async function handleAttachmentUpload(type: "ID_DOCUMENT" | "ADDRESS_PROOF", file: File) {
    if (!editing) return;
    setUploadingType(type);
    try {
      const ok = await uploadAttachmentForStudent(editing.id, type, file);
      if (ok) {
        toast.push("success", "Documento anexado.");
        await loadAttachments(editing.id);
      }
    } finally {
      setUploadingType(null);
    }
  }

  function handlePendingFile(type: "ID_DOCUMENT" | "ADDRESS_PROOF", file: File | null) {
    if (file) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.push("error", "Aceito apenas PDF, JPG ou PNG.");
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.push("error", "Arquivo deve ter no máximo 5MB.");
        return;
      }
    }
    if (type === "ID_DOCUMENT") setPendingIdDocument(file);
    else setPendingAddressProof(file);
  }

  async function removeAttachment(attachmentId: string) {
    if (!editing || !isMaster) return;
    if (!confirm("Remover este anexo? (apenas MASTER pode remover.)")) return;
    const res = await fetch(`/api/students/${editing.id}/attachments/${attachmentId}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ attachment: StudentAttachment }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? (json as { error?: { message?: string } }).error?.message : "Falha ao remover.");
      return;
    }
    toast.push("success", "Anexo removido.");
    await loadAttachments(editing.id);
  }

  function formatBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  const attachmentByIdDoc = attachments.find((a) => a.type === "ID_DOCUMENT");
  const attachmentByAddress = attachments.find((a) => a.type === "ADDRESS_PROOF");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-lg font-semibold">Alunos</div>
          <div className="text-sm text-zinc-600">
            Cadastro base do aluno. Busca por nome ou CPF.
          </div>
        </div>
        <Button onClick={openCreate}>Novo aluno</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nome ou CPF"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        {isMaster && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
            />
            Incluir excluídos
          </label>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-zinc-600">Carregando...</div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>CPF</Th>
              <Th>Celular</Th>
              <Th>Escolaridade</Th>
              <Th>Estudando?</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <Td>
                  <span className={s.deletedAt ? "text-zinc-500 line-through" : ""}>{s.name}</span>
                  {s.deletedAt && (
                    <Badge tone="red" className="ml-1">
                      Excluído
                    </Badge>
                  )}
                </Td>
                <Td>{formatCpf(s.cpf)}</Td>
                <Td>{formatPhone(s.phone)}</Td>
                <Td>{EDUCATION_LEVEL_LABELS[s.educationLevel] ?? s.educationLevel}</Td>
                <Td>{s.isStudying ? STUDY_SHIFT_LABELS[s.studyShift ?? ""] ?? s.studyShift : "Não"}</Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    {!s.deletedAt && (
                      <Button variant="secondary" onClick={() => openEdit(s)}>
                        Editar
                      </Button>
                    )}
                    {isMaster && (
                      s.deletedAt ? (
                        <Button variant="secondary" onClick={() => reactivate(s)}>
                          Reativar
                        </Button>
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
                  </div>
                </Td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <Td colSpan={6} className="text-zinc-600">
                  Nenhum aluno encontrado.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      )}

      <Modal
        open={open}
        title={editing ? "Editar aluno" : "Novo aluno"}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
      >
        <form className="flex flex-col gap-4" onSubmit={save}>
          {/* 1) Dados do aluno */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-zinc-800">Dados do aluno</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Nome *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(toTitleCase(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Data de nascimento *</label>
                <Input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Gênero *</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Student["gender"])}
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                >
                  {Object.entries(GENDER_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">CPF *</label>
                <Input
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  className={`mt-1 ${cpfInvalid ? "border-red-500" : ""}`}
                />
                {cpfInvalid && (
                  <p className="mt-1 text-xs text-red-600">CPF inválido. Verifique os dígitos.</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">RG *</label>
                <Input value={rg} onChange={(e) => setRg(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">E-mail</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                  placeholder="exemplo@email.com"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Se preenchido, o aluno poderá acessar o sistema com este e-mail e senha (CPF).
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Celular *</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* 2) Endereço */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-zinc-800">Endereço</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">CEP</label>
                <Input
                  value={cep}
                  onChange={(e) => setCep(formatCep(e.target.value))}
                  onBlur={() => void fetchAddressByCep()}
                  placeholder="00000-000"
                  className="mt-1"
                  disabled={loadingCep}
                />
                {loadingCep && <p className="mt-1 text-xs text-zinc-500">Buscando endereço...</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Rua *</label>
                <Input value={street} onChange={(e) => setStreet(e.target.value)} className="mt-1" placeholder="Nome da rua" />
              </div>
              <div>
                <label className="text-sm font-medium">Número *</label>
                <Input value={number} onChange={(e) => setNumber(e.target.value)} className="mt-1" placeholder="Nº" />
              </div>
              <div>
                <label className="text-sm font-medium">Complemento</label>
                <Input value={complement} onChange={(e) => setComplement(e.target.value)} className="mt-1" placeholder="Apto, bloco, etc." />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Bairro *</label>
                <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="mt-1" placeholder="Bairro" />
              </div>
              <div>
                <label className="text-sm font-medium">Cidade *</label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1" placeholder="Belém" />
              </div>
              <div>
                <label className="text-sm font-medium">UF *</label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                >
                  {["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"].map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 3) Escolaridade / Estudo */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-zinc-800">Escolaridade / Estudo</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Escolaridade *</label>
                <select
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value as Student["educationLevel"])}
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                >
                  {Object.entries(EDUCATION_LEVEL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  id="isStudying"
                  type="checkbox"
                  checked={isStudying}
                  onChange={(e) => setIsStudying(e.target.checked)}
                />
                <label htmlFor="isStudying" className="text-sm">
                  Está estudando atualmente?
                </label>
              </div>
              {isStudying && (
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium">Turno de estudo *</label>
                  <select
                    value={studyShift ?? ""}
                    onChange={(e) => setStudyShift((e.target.value || null) as Student["studyShift"])}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="">Selecione</option>
                    {Object.entries(STUDY_SHIFT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 4) Deficiência */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-zinc-800">Deficiência</div>
            <div className="flex items-center gap-2">
              <input
                id="hasDisability"
                type="checkbox"
                checked={hasDisability}
                onChange={(e) => setHasDisability(e.target.checked)}
              />
              <label htmlFor="hasDisability" className="text-sm">
                Possui deficiência
              </label>
            </div>
            {hasDisability && (
              <div>
                <label className="text-sm font-medium">Qual deficiência? *</label>
                <Input
                  value={disabilityDescription}
                  onChange={(e) => setDisabilityDescription(e.target.value)}
                  className="mt-1"
                  placeholder="Descreva (mín. 3 caracteres)"
                />
              </div>
            )}
          </div>

          {/* 5) Responsável (obrigatório se menor de 18 — calculado pela data de nascimento) */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-zinc-800">
              Responsável
              {isMinor ? (
                <span className="ml-1 text-amber-600">* obrigatório (menor de 18 anos)</span>
              ) : (
                <span className="ml-1 text-zinc-500 font-normal">(opcional para maior de 18 anos)</span>
              )}
            </div>
            {isMinor && (
              <p className="rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                A data de nascimento indica que o aluno é menor de 18 anos. Preencha os dados do responsável (nome, CPF, celular e parentesco).
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Nome do responsável {isMinor && "*"}</label>
                <Input
                  value={guardianName}
                  onChange={(e) => setGuardianName(toTitleCase(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">CPF do responsável {isMinor && "*"}</label>
                <Input
                  value={guardianCpf}
                  onChange={(e) => setGuardianCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">RG do responsável</label>
                <Input value={guardianRg} onChange={(e) => setGuardianRg(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Celular do responsável {isMinor && "*"}</label>
                <Input
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Parentesco {isMinor && "*"}</label>
                <Input
                  value={guardianRelationship}
                  onChange={(e) => setGuardianRelationship(e.target.value)}
                  placeholder="ex.: Pai, Mãe"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* 6) Anexos (opcional) */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-zinc-800">Anexos (opcional)</div>
            <p className="text-xs text-zinc-500">PDF, JPG ou PNG, máx. 5MB. {!editing && "Os arquivos serão enviados ao salvar o aluno."}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Documento (RG/CPF/CNH) */}
              <div className="rounded border border-zinc-200 p-3">
                <div className="text-sm font-medium text-zinc-700">Documento (RG/CPF/CNH)</div>
                {editing && attachmentByIdDoc ? (
                  <div className="mt-2 flex flex-col gap-1 text-sm">
                    <span className="truncate text-zinc-800">{attachmentByIdDoc.fileName ?? "Arquivo"}</span>
                    {attachmentByIdDoc.sizeBytes != null && (
                      <span className="text-zinc-500">{formatBytes(attachmentByIdDoc.sizeBytes)}</span>
                    )}
                    <span className="text-zinc-500">{new Date(attachmentByIdDoc.createdAt).toLocaleDateString("pt-BR")}</span>
                    <div className="mt-1 flex gap-2">
                      <a href={attachmentByIdDoc.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                        Visualizar
                      </a>
                      <label className="cursor-pointer text-blue-600 underline">
                        Substituir
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                          className="sr-only"
                          disabled={uploadingType === "ID_DOCUMENT"}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleAttachmentUpload("ID_DOCUMENT", f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {isMaster && (
                        <button
                          type="button"
                          onClick={() => removeAttachment(attachmentByIdDoc.id)}
                          className="text-red-600 underline"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                ) : !editing && pendingIdDocument ? (
                  <div className="mt-2 flex flex-col gap-1 text-sm">
                    <span className="truncate text-zinc-800">{pendingIdDocument.name}</span>
                    <span className="text-zinc-500">{formatBytes(pendingIdDocument.size)}</span>
                    <button type="button" onClick={() => handlePendingFile("ID_DOCUMENT", null)} className="mt-1 text-left text-red-600 underline">
                      Remover
                    </button>
                  </div>
                ) : (
                  <label className="mt-2 flex cursor-pointer flex-col items-start gap-1 text-sm text-blue-600 underline">
                    Enviar arquivo
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      className="sr-only"
                      disabled={editing ? uploadingType === "ID_DOCUMENT" : false}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          if (editing) void handleAttachmentUpload("ID_DOCUMENT", f);
                          else handlePendingFile("ID_DOCUMENT", f);
                        }
                        e.target.value = "";
                      }}
                    />
                    {editing && uploadingType === "ID_DOCUMENT" && "Enviando…"}
                  </label>
                )}
              </div>
              {/* Comprovante de endereço */}
              <div className="rounded border border-zinc-200 p-3">
                <div className="text-sm font-medium text-zinc-700">Comprovante de endereço</div>
                {editing && attachmentByAddress ? (
                  <div className="mt-2 flex flex-col gap-1 text-sm">
                    <span className="truncate text-zinc-800">{attachmentByAddress.fileName ?? "Arquivo"}</span>
                    {attachmentByAddress.sizeBytes != null && (
                      <span className="text-zinc-500">{formatBytes(attachmentByAddress.sizeBytes)}</span>
                    )}
                    <span className="text-zinc-500">{new Date(attachmentByAddress.createdAt).toLocaleDateString("pt-BR")}</span>
                    <div className="mt-1 flex gap-2">
                      <a href={attachmentByAddress.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                        Visualizar
                      </a>
                      <label className="cursor-pointer text-blue-600 underline">
                        Substituir
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                          className="sr-only"
                          disabled={uploadingType === "ADDRESS_PROOF"}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleAttachmentUpload("ADDRESS_PROOF", f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {isMaster && (
                        <button
                          type="button"
                          onClick={() => removeAttachment(attachmentByAddress.id)}
                          className="text-red-600 underline"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                ) : !editing && pendingAddressProof ? (
                  <div className="mt-2 flex flex-col gap-1 text-sm">
                    <span className="truncate text-zinc-800">{pendingAddressProof.name}</span>
                    <span className="text-zinc-500">{formatBytes(pendingAddressProof.size)}</span>
                    <button type="button" onClick={() => handlePendingFile("ADDRESS_PROOF", null)} className="mt-1 text-left text-red-600 underline">
                      Remover
                    </button>
                  </div>
                ) : (
                  <label className="mt-2 flex cursor-pointer flex-col items-start gap-1 text-sm text-blue-600 underline">
                    Enviar arquivo
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      className="sr-only"
                      disabled={editing ? uploadingType === "ADDRESS_PROOF" : false}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          if (editing) void handleAttachmentUpload("ADDRESS_PROOF", f);
                          else handlePendingFile("ADDRESS_PROOF", f);
                        }
                        e.target.value = "";
                      }}
                    />
                    {editing && uploadingType === "ADDRESS_PROOF" && "Enviando…"}
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
