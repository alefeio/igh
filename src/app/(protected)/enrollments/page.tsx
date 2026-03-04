"use client";

import { useEffect, useState } from "react";

import { StudentForm } from "@/components/students/StudentForm";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1";
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_CERT_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

type Student = { id: string; name: string; email: string | null };
type Course = { id: string; name: string };
type ClassGroup = {
  id: string;
  startDate: string;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  course: Course;
};
type Enrollment = {
  id: string;
  enrolledAt: string;
  status: string;
  isPreEnrollment?: boolean;
  enrollmentConfirmedAt: string | null;
  certificateUrl?: string | null;
  certificateFileName?: string | null;
  student: Student;
  classGroup: ClassGroup;
  studentDataComplete?: boolean;
};

async function parseJson<T>(res: Response): Promise<ApiResponse<T> | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return null;
  }
}

export default function EnrollmentsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Enrollment[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editCertFile, setEditCertFile] = useState<File | null>(null);
  const [editRemovingCert, setEditRemovingCert] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [studentId, setStudentId] = useState("");
  const [classGroupId, setClassGroupId] = useState("");
  const [createCertFile, setCreateCertFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [openNewStudent, setOpenNewStudent] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/enrollments");
      const json = await parseJson<{ enrollments: Enrollment[] }>(res);
      if (res.ok && json?.ok) setItems(json.data.enrollments);
      else toast.push("error", "Falha ao carregar matrículas.");
    } finally {
      setLoading(false);
    }
  }

  async function loadFormOptions() {
    const [studentsRes, classGroupsRes] = await Promise.all([
      fetch("/api/students"),
      fetch("/api/class-groups"),
    ]);
    const studentsJson = await parseJson<{ students: Student[] }>(studentsRes);
    const classGroupsJson = await parseJson<{ classGroups: ClassGroup[] }>(classGroupsRes);
    if (studentsJson?.ok) setStudents(studentsJson.data.students.filter((s) => s.email));
    if (classGroupsJson?.ok) setClassGroups(classGroupsJson.data.classGroups);
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setStudentId("");
    setClassGroupId("");
    setCreateCertFile(null);
    setOpen(true);
    void loadFormOptions();
  }

  function openEdit(e: Enrollment) {
    setEditingEnrollment(e);
    setEditStatus(e.status);
    setEditCertFile(null);
    setEditRemovingCert(false);
    setEditOpen(true);
  }

  async function confirmPreEnrollment(e: Enrollment) {
    const res = await fetch(`/api/enrollments/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPreEnrollment: false }),
    });
    const json = (await res.json()) as ApiResponse<{ enrollment: Enrollment }>;
    if (!res.ok || !json?.ok) {
      toast.push("error", json && "error" in json ? json.error.message : "Falha ao confirmar.");
      return;
    }
    toast.push("success", "Pré-matrícula confirmada.");
    void load();
  }

  async function uploadCertificateForEnrollment(
    enrollmentId: string,
    file: File
  ): Promise<{ url: string; publicId: string; fileName: string } | null> {
    if (file.size > MAX_FILE_BYTES) {
      toast.push("error", "Arquivo deve ter no máximo 5MB.");
      return null;
    }
    if (!ALLOWED_CERT_TYPES.includes(file.type)) {
      toast.push("error", "Use PDF ou imagem (JPEG, PNG).");
      return null;
    }
    const signRes = await fetch("/api/uploads/cloudinary-signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId }),
    });
    const signJson = (await signRes.json()) as ApiResponse<{
      timestamp: number;
      signature: string;
      apiKey: string;
      cloudName: string;
      folder: string;
    }>;
    if (!signRes.ok || !signJson.ok) {
      toast.push("error", "Falha ao obter permissão de upload.");
      return null;
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
      original_filename?: string;
      error?: { message?: string };
    };
    if (!uploadRes.ok || !cloudResult.secure_url || !cloudResult.public_id) {
      toast.push("error", cloudResult?.error?.message ?? "Falha no upload.");
      return null;
    }
    return {
      url: cloudResult.secure_url,
      publicId: cloudResult.public_id,
      fileName: cloudResult.original_filename ?? file.name,
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !classGroupId || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, classGroupId }),
      });
      const json = await parseJson<{ enrollment: Enrollment; emailSent: boolean }>(res);
      if (!res.ok || !json?.ok) {
        toast.push("error", !json?.ok && json && "error" in json ? json.error.message : "Falha ao matricular.");
        return;
      }
      const created = json.data.enrollment;
      const emailSent = json.data.emailSent;
      if (createCertFile) {
        const up = await uploadCertificateForEnrollment(created.id, createCertFile);
        if (up) {
          await fetch(`/api/enrollments/${created.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              certificateUrl: up.url,
              certificatePublicId: up.publicId,
              certificateFileName: up.fileName,
            }),
          });
        }
      }
      toast.push(
        "success",
        emailSent
          ? "Matrícula criada. E-mail de boas-vindas enviado ao aluno."
          : "Matrícula criada. E-mail não foi enviado (verifique configuração)."
      );
      setOpen(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEnrollment || editSubmitting) return;
    setEditSubmitting(true);
    try {
      const body: { status: string; certificateUrl?: string | null; certificatePublicId?: string | null; certificateFileName?: string | null } = {
        status: editStatus,
      };
      if (editRemovingCert) {
        body.certificateUrl = null;
        body.certificatePublicId = null;
        body.certificateFileName = null;
      } else if (editCertFile) {
        const up = await uploadCertificateForEnrollment(editingEnrollment.id, editCertFile);
        if (up) {
          body.certificateUrl = up.url;
          body.certificatePublicId = up.publicId;
          body.certificateFileName = up.fileName;
        }
      }
      const res = await fetch(`/api/enrollments/${editingEnrollment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await parseJson<{ enrollment: Enrollment }>(res);
      if (!res.ok || !json?.ok) {
        toast.push("error", json && "error" in json ? json.error.message : "Falha ao salvar.");
        return;
      }
      toast.push("success", "Matrícula atualizada.");
      setEditOpen(false);
      setEditingEnrollment(null);
      await load();
    } finally {
      setEditSubmitting(false);
    }
  }

  function handleNewStudentSuccess(student: { id: string; name: string; email: string | null }) {
    setOpenNewStudent(false);
    setStudents((prev) => (prev.some((s) => s.id === student.id) ? prev : [...prev, student]));
    setStudentId(student.id);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-lg font-semibold">Matrículas</div>
          <div className="text-sm text-zinc-600">
            Ao matricular um aluno em uma turma, um e-mail com link de confirmação e credenciais é enviado.
          </div>
        </div>
        <Button onClick={openCreate} className="w-full shrink-0 sm:w-auto">Nova matrícula</Button>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-600">Carregando...</div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Aluno</Th>
              <Th>Curso / Turma</Th>
              <Th>Data matrícula</Th>
              <Th>Pré-matrícula</Th>
              <Th>Dados completos</Th>
              <Th>Confirmado</Th>
              <Th>Certificado</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id}>
                <Td>
                  <div>
                    <div className="font-medium">{e.student.name}</div>
                    <div className="text-xs text-zinc-500">{e.student.email ?? "-"}</div>
                  </div>
                </Td>
                <Td>
                  <div>
                    <div>{e.classGroup.course.name}</div>
                    <div className="text-xs text-zinc-500">
                      {e.classGroup.startTime} - {e.classGroup.endTime} •{" "}
                      {Array.isArray(e.classGroup.daysOfWeek) ? e.classGroup.daysOfWeek.join(", ") : "-"}
                    </div>
                  </div>
                </Td>
                <Td>{new Date(e.enrolledAt).toLocaleDateString("pt-BR")}</Td>
                <Td>{e.isPreEnrollment ? <Badge tone="amber">Pré-matrícula</Badge> : "—"}</Td>
                <Td>
                  {e.studentDataComplete === true ? (
                    <Badge tone="green">Sim</Badge>
                  ) : e.studentDataComplete === false ? (
                    <Badge tone="zinc">Não</Badge>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>{e.enrollmentConfirmedAt ? new Date(e.enrollmentConfirmedAt).toLocaleString("pt-BR") : "-"}</Td>
                <Td>
                  {e.certificateUrl ? (
                    <a href={e.certificateUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">
                      {e.certificateFileName ?? "Sim"}
                    </a>
                  ) : "—"}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    {e.isPreEnrollment && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => confirmPreEnrollment(e)}
                      >
                        Confirmar
                      </Button>
                    )}
                    <Button type="button" variant="secondary" onClick={() => openEdit(e)}>
                      Editar
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <Td colSpan={8} className="text-zinc-600">
                  Nenhuma matrícula cadastrada.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      )}

      <Modal open={open} title="Nova matrícula" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium">Aluno (com e-mail)</label>
            <Button type="button" variant="secondary" onClick={() => setOpenNewStudent(true)}>
              Cadastrar aluno
            </Button>
          </div>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            required
          >
            <option value="">Selecione</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email})
              </option>
            ))}
          </select>
          <div>
            <label className="text-sm font-medium">Turma</label>
            <select
              value={classGroupId}
              onChange={(e) => setClassGroupId(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Selecione</option>
              {classGroups.map((cg) => (
                <option key={cg.id} value={cg.id}>
                  {cg.course.name} — Início {typeof cg.startDate === "string" ? new Date(cg.startDate).toLocaleDateString("pt-BR") : ""} —{" "}
                  {cg.startTime}-{cg.endTime} — {Array.isArray(cg.daysOfWeek) ? cg.daysOfWeek.join(", ") : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Certificado (opcional)</label>
            <input
              type="file"
              accept=".pdf,image/jpeg,image/jpg,image/png"
              className="mt-1 w-full text-sm"
              onChange={(e) => setCreateCertFile(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-xs text-zinc-500">PDF ou imagem, máx. 5MB.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : "Matricular e enviar e-mail"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={editOpen} title="Editar matrícula" onClose={() => { setEditOpen(false); setEditingEnrollment(null); }}>
        {editingEnrollment && (
          <form onSubmit={submitEdit} className="flex flex-col gap-4">
            <div>
              <div className="text-sm font-medium text-zinc-600">Aluno</div>
              <p className="mt-0.5 font-medium">{editingEnrollment.student.name}</p>
              <p className="text-xs text-zinc-500">{editingEnrollment.student.email ?? "-"}</p>
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-600">Turma</div>
              <p className="mt-0.5">{editingEnrollment.classGroup.course.name} — {editingEnrollment.classGroup.startTime}-{editingEnrollment.classGroup.endTime}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="ACTIVE">Ativa</option>
                <option value="CANCELLED">Cancelada</option>
                <option value="COMPLETED">Concluída</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Certificado</label>
              {editingEnrollment.certificateUrl ? (
                <div className="mt-1 space-y-2">
                  <a
                    href={editingEnrollment.certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-blue-600 underline text-sm"
                  >
                    {editingEnrollment.certificateFileName ?? "Ver certificado"}
                  </a>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editRemovingCert}
                      onChange={(e) => setEditRemovingCert(e.target.checked)}
                    />
                    Remover certificado
                  </label>
                  {!editRemovingCert && (
                    <p className="text-xs text-zinc-500">Ou selecione um novo arquivo para substituir:</p>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-xs text-zinc-500">Nenhum certificado anexado.</p>
              )}
              {!editRemovingCert && (
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/jpg,image/png"
                  className="mt-1 w-full text-sm"
                  onChange={(e) => setEditCertFile(e.target.files?.[0] ?? null)}
                />
              )}
              <p className="mt-1 text-xs text-zinc-500">PDF ou imagem, máx. 5MB.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={openNewStudent} title="Cadastrar aluno" onClose={() => setOpenNewStudent(false)}>
        <StudentForm
          editing={null}
          onSuccess={handleNewStudentSuccess}
          onCancel={() => setOpenNewStudent(false)}
        />
      </Modal>
    </div>
  );
}
