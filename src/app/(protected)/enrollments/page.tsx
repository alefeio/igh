"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import * as XLSX from "xlsx";

import { StudentForm } from "@/components/students/StudentForm";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
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
  capacity?: number;
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
  const user = useUser();
  const toast = useToast();
  const isMaster = user.role === "MASTER";
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Enrollment[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editClassGroupId, setEditClassGroupId] = useState("");
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
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);
  const studentComboboxRef = useRef<HTMLDivElement>(null);
  const [listFilter, setListFilter] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

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
    if (studentsJson?.ok) setStudents(studentsJson.data.students);
    if (classGroupsJson?.ok) setClassGroups(classGroupsJson.data.classGroups);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [listFilter, pageSize]);

  const dashboard = (() => {
    const byClassGroup = new Map<string, { classGroup: ClassGroup; count: number }>();
    for (const e of items) {
      const cg = e.classGroup;
      const cur = byClassGroup.get(cg.id);
      if (!cur) byClassGroup.set(cg.id, { classGroup: cg, count: 1 });
      else cur.count++;
    }
    const byCourse = new Map<string, { courseName: string; turmas: { classGroup: ClassGroup; count: number }[] }>();
    for (const { classGroup, count } of byClassGroup.values()) {
      const cid = classGroup.course.id;
      const name = classGroup.course.name;
      if (!byCourse.has(cid)) byCourse.set(cid, { courseName: name, turmas: [] });
      byCourse.get(cid)!.turmas.push({ classGroup, count });
    }
    for (const row of byCourse.values()) {
      row.turmas.sort((a, b) => (a.classGroup.startDate < b.classGroup.startDate ? -1 : 1));
    }
    const courses = Array.from(byCourse.entries()).sort((a, b) =>
      a[1].courseName.localeCompare(b[1].courseName)
    );
    return { courses, total: items.length };
  })();

  const activeCountByClassGroup = (() => {
    const m = new Map<string, number>();
    for (const e of items) {
      if (e.status !== "ACTIVE") continue;
      const id = e.classGroup.id;
      m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  })();

  const filteredItems = useMemo(() => {
    const q = listFilter.trim().toLowerCase();
    if (q.length === 0) return items;
    return items.filter(
      (e) =>
        e.student.name.toLowerCase().includes(q) ||
        e.classGroup.course.name.toLowerCase().includes(q)
    );
  }, [items, listFilter]);

  const totalFiltered = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const paginatedItems = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, pageSafe, pageSize]);

  const pieData = dashboard.courses.map(([, { courseName, turmas }]) => ({
    name: courseName,
    value: turmas.reduce((s, t) => s + t.count, 0),
  }));

  const byDay = new Map<string, number>();
  for (const e of items) {
    const d = new Date(e.enrolledAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  const columnData = [...byDay.entries()]
    .sort((a, b) => {
      const [da, db] = [a[0], b[0]].map((s) => {
        const [dd, mm, yyyy] = s.split("/");
        return new Date(Number(yyyy), Number(mm) - 1, Number(dd)).getTime();
      });
      return da - db;
    })
    .map(([data, quantidade]) => ({ data, quantidade }));

  const PIE_COLORS = ["#0066b3", "#1a365d", "#e87500", "#0d9488", "#7c3aed", "#dc2626", "#65a30d", "#ca8a04"];

  function exportToExcel() {
    const sorted = [...items].sort((a, b) => a.student.name.localeCompare(b.student.name, "pt-BR"));
    const rows = sorted.map((e) => ({
      Aluno: e.student.name,
      "Curso/Turma": `${e.classGroup.course.name} — ${e.classGroup.startTime}-${e.classGroup.endTime}${Array.isArray(e.classGroup.daysOfWeek) && e.classGroup.daysOfWeek.length ? ` (${e.classGroup.daysOfWeek.join(", ")})` : ""}`,
      "Data matrícula": new Date(e.enrolledAt).toLocaleDateString("pt-BR"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Matrículas");
    XLSX.writeFile(wb, `matriculas_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.push("success", "Planilha exportada.");
  }

  function openCreate() {
    setStudentId("");
    setClassGroupId("");
    setStudentSearchQuery("");
    setStudentDropdownOpen(false);
    setCreateCertFile(null);
    setOpen(true);
    void loadFormOptions();
  }

  function openEdit(e: Enrollment) {
    setEditingEnrollment(e);
    setEditStatus(e.status);
    setEditClassGroupId(e.classGroup.id);
    setEditCertFile(null);
    setEditRemovingCert(false);
    setEditOpen(true);
    void loadFormOptions();
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

  async function deleteEnrollment(e: Enrollment) {
    if (!confirm(`Excluir a matrícula de ${e.student.name} em ${e.classGroup.course.name}? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/enrollments/${e.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted?: boolean }>;
    if (!res.ok || !json?.ok) {
      toast.push("error", json && "error" in json ? json.error.message : "Falha ao excluir matrícula.");
      return;
    }
    toast.push("success", "Matrícula excluída.");
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
    const active = activeCountByClassGroup.get(classGroupId) ?? 0;
    const cg = classGroups.find((c) => c.id === classGroupId);
    if (cg && (cg.capacity ?? 0) > 0 && active >= (cg.capacity ?? 0)) {
      toast.push("error", "Esta turma está lotada. Escolha outra turma.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, classGroupId }),
      });
      const json = await parseJson<{ enrollment: Enrollment; emailSent: boolean; studentHadNoEmail?: boolean }>(res);
      if (!res.ok || !json?.ok) {
        toast.push("error", !json?.ok && json && "error" in json ? json.error.message : "Falha ao matricular.");
        return;
      }
      const created = json.data.enrollment;
      const emailSent = json.data.emailSent;
      const studentHadNoEmail = json.data.studentHadNoEmail;
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
          : studentHadNoEmail
            ? "Matrícula criada. Aluno sem e-mail; link de confirmação não enviado."
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
      const body: { status: string; classGroupId?: string; certificateUrl?: string | null; certificatePublicId?: string | null; certificateFileName?: string | null } = {
        status: editStatus,
      };
      if (editClassGroupId && editClassGroupId !== editingEnrollment.classGroup.id) {
        body.classGroupId = editClassGroupId;
      }
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
          <div className="text-lg font-semibold text-[var(--text-primary)]">Matrículas</div>
          <div className="text-sm text-[var(--text-secondary)]">
            Ao matricular um aluno em uma turma, um e-mail com link de confirmação e credenciais é enviado.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportToExcel} disabled={items.length === 0}>
            Exportar para Excel
          </Button>
          <Button onClick={openCreate} className="w-full shrink-0 sm:w-auto">Nova matrícula</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--text-secondary)]">Carregando...</div>
      ) : (
        <div className="flex flex-col gap-6">
          {(pieData.length > 0 || columnData.length > 0) && (
            <section
              className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm"
              aria-label="Gráficos de matrículas"
            >
              <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">Gráficos</h2>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {pieData.length > 0 && (
                  <div className="flex flex-col">
                    <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Matrículas por curso</h3>
                    <div className="h-[280px] w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                          >
                            {pieData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number | undefined) => [value ?? 0, "Matrículas"]}
                            contentStyle={{
                              backgroundColor: "var(--card-bg)",
                              border: "1px solid var(--card-border)",
                              borderRadius: "8px",
                              color: "var(--text-primary)",
                            }}
                            labelStyle={{ color: "var(--text-primary)" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                {columnData.length > 0 && (
                  <div className="flex flex-col">
                    <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Matrículas por dia</h3>
                    <div className="h-[280px] w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={columnData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <XAxis
                            dataKey="data"
                            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                            stroke="var(--card-border)"
                          />
                          <YAxis
                            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                            stroke="var(--card-border)"
                            allowDecimals={false}
                          />
                          <Tooltip
                            formatter={(value: number | undefined) => [value ?? 0, "Matrículas"]}
                            labelStyle={{ color: "var(--text-primary)" }}
                            contentStyle={{
                              backgroundColor: "var(--card-bg)",
                              border: "1px solid var(--card-border)",
                              borderRadius: "8px",
                              color: "var(--text-primary)",
                            }}
                          />
                          <Bar dataKey="quantidade" fill="var(--igh-primary)" radius={[4, 4, 0, 0]} name="Matrículas" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          <section
            className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm"
            aria-label="Resumo de matrículas por curso e turma"
          >
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Resumo por curso e turma</h2>
            {dashboard.courses.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-secondary)]">Nenhuma matrícula para exibir.</p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {dashboard.courses.map(([courseId, { courseName, turmas }]) => (
                    <div
                      key={courseId}
                      className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-4"
                    >
                      <div className="font-medium text-[var(--text-primary)]">{courseName}</div>
                      <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-[var(--text-secondary)]">
                        {turmas.map(({ classGroup: cg, count }) => {
                          const start = typeof cg.startDate === "string" ? new Date(cg.startDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
                          const days = Array.isArray(cg.daysOfWeek) ? cg.daysOfWeek.join(", ") : "";
                          const label = `Início ${start} — ${cg.startTime}-${cg.endTime}${days ? ` • ${days}` : ""}`;
                          const cap = cg.capacity != null ? ` / ${cg.capacity}` : "";
                          return (
                            <li key={cg.id}>
                              {label}: <strong>{count}{cap}</strong>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-[var(--card-border)] pt-3">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Total de matrículas: </span>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{dashboard.total}</span>
                </div>
              </>
            )}
          </section>

          <section aria-label="Listagem de matrículas">
            <div className="mb-4 flex flex-wrap items-end gap-4">
              <div>
                <label htmlFor="enrollments-list-filter" className="text-sm font-medium text-[var(--text-secondary)]">
                  Filtrar por nome do aluno ou curso
                </label>
                <input
                  id="enrollments-list-filter"
                  type="text"
                  value={listFilter}
                  onChange={(e) => setListFilter(e.target.value)}
                  placeholder="Digite para pesquisar..."
                  className="theme-input mt-1 max-w-md rounded border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="enrollments-page-size" className="text-sm font-medium text-[var(--text-secondary)]">
                  Registros por página
                </label>
                <select
                  id="enrollments-page-size"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="theme-input rounded border px-3 py-2 text-sm"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
              </div>
            </div>
            <Table>
          <thead>
            <tr>
              <Th>Aluno</Th>
              <Th>Curso / Turma</Th>
              <Th>Data matrícula</Th>
              <Th>Dados completos</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((e) => (
              <tr key={e.id}>
                <Td>
                  <div>
                    <div className="font-medium">{e.student.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{e.student.email ?? "-"}</div>
                  </div>
                </Td>
                <Td>
                  <div>
                    <div>{e.classGroup.course.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {e.classGroup.startTime} - {e.classGroup.endTime} •{" "}
                      {Array.isArray(e.classGroup.daysOfWeek) ? e.classGroup.daysOfWeek.join(", ") : "-"}
                    </div>
                  </div>
                </Td>
                <Td>{new Date(e.enrolledAt).toLocaleDateString("pt-BR")}</Td>
                <Td>
                  {e.studentDataComplete === true ? (
                    <Badge tone="green">Sim</Badge>
                  ) : e.studentDataComplete === false ? (
                    <Badge tone="zinc">Não</Badge>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    {isMaster && e.isPreEnrollment && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => confirmPreEnrollment(e)}
                      >
                        Confirmar
                      </Button>
                    )}
                    {(isMaster || user.role === "ADMIN") && (
                      <Button type="button" variant="secondary" onClick={() => openEdit(e)}>
                        Editar
                      </Button>
                    )}
                    {isMaster && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => deleteEnrollment(e)}
                      >
                        Excluir
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
            {paginatedItems.length === 0 && (
              <tr>
                <Td colSpan={5} className="text-[var(--text-secondary)]">
                  {items.length === 0
                    ? "Nenhuma matrícula cadastrada."
                    : "Nenhuma matrícula encontrada com esse filtro."}
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--card-border)] pt-3">
              <p className="text-sm text-[var(--text-muted)]">
                {totalFiltered === 0
                  ? "Nenhuma matrícula na listagem"
                  : `Exibindo ${(pageSafe - 1) * pageSize + 1}–${Math.min(pageSafe * pageSize, totalFiltered)} de ${totalFiltered} matrículas`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="text-sm text-[var(--text-secondary)]">
                  Página {pageSafe} de {totalPages}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}

      <Modal open={open} title="Nova matrícula" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium">Aluno</label>
            <Button type="button" variant="secondary" onClick={() => setOpenNewStudent(true)}>
              Cadastrar aluno
            </Button>
          </div>
          <div ref={studentComboboxRef} className="relative">
            <input
              type="text"
              value={
                studentId
                  ? (() => {
                      const s = students.find((x) => x.id === studentId);
                      return s ? `${s.name}${s.email ? ` (${s.email})` : " (sem e-mail)"}` : studentSearchQuery;
                    })()
                  : studentSearchQuery
              }
              onChange={(e) => {
                setStudentSearchQuery(e.target.value);
                setStudentId("");
                setStudentDropdownOpen(true);
              }}
              onFocus={() => setStudentDropdownOpen(true)}
              onBlur={() => setTimeout(() => setStudentDropdownOpen(false), 150)}
              placeholder="Digite o nome ou e-mail do aluno..."
              className="theme-input w-full rounded border px-3 py-2 text-sm"
              autoComplete="off"
            />
            {studentDropdownOpen && (
              <ul
                className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-[var(--card-border)] bg-[var(--card-bg)] py-1 shadow-lg"
                role="listbox"
              >
                {(() => {
                  const q = studentSearchQuery.trim().toLowerCase();
                  const filtered =
                    q.length === 0
                      ? students
                      : students.filter(
                          (s) =>
                            s.name.toLowerCase().includes(q) ||
                            (s.email?.toLowerCase().includes(q) ?? false)
                        );
                  if (filtered.length === 0) {
                    return (
                      <li className="px-3 py-2 text-sm text-[var(--text-muted)]">
                        Nenhum aluno encontrado.
                      </li>
                    );
                  }
                  return filtered.map((s) => {
                    const label = `${s.name}${s.email ? ` (${s.email})` : " (sem e-mail)"}`;
                    return (
                      <li
                        key={s.id}
                        role="option"
                        className="cursor-pointer px-3 py-2 text-sm hover:bg-[var(--igh-surface)]"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setStudentId(s.id);
                          setStudentSearchQuery("");
                          setStudentDropdownOpen(false);
                        }}
                      >
                        {label}
                      </li>
                    );
                  });
                })()}
              </ul>
            )}
          </div>
          {!studentId && (
            <p className="text-xs text-[var(--text-muted)]">Selecione um aluno da lista ao digitar.</p>
          )}
          <div>
            <label className="text-sm font-medium">Turma</label>
            <select
              value={classGroupId}
              onChange={(e) => setClassGroupId(e.target.value)}
              className="theme-input mt-1 w-full rounded border px-3 py-2 text-sm"
              required
            >
              <option value="">Selecione</option>
              {classGroups.map((cg) => {
                const active = activeCountByClassGroup.get(cg.id) ?? 0;
                const cap = cg.capacity ?? 0;
                const full = cap > 0 && active >= cap;
                return (
                  <option key={cg.id} value={cg.id} disabled={full}>
                    {cg.course.name} — Início {typeof cg.startDate === "string" ? new Date(cg.startDate).toLocaleDateString("pt-BR") : ""} — {cg.startTime}-{cg.endTime}
                    {Array.isArray(cg.daysOfWeek) && cg.daysOfWeek.length ? ` — ${cg.daysOfWeek.join(", ")}` : ""}
                    {full ? ` (lotada ${active}/${cap})` : ""}
                  </option>
                );
              })}
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
            <p className="mt-1 text-xs text-[var(--text-muted)]">PDF ou imagem, máx. 5MB.</p>
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
              <div className="text-sm font-medium text-[var(--text-secondary)]">Aluno</div>
              <p className="mt-0.5 font-medium">{editingEnrollment.student.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{editingEnrollment.student.email ?? "-"}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Turma</label>
              <select
                value={editClassGroupId}
                onChange={(e) => setEditClassGroupId(e.target.value)}
                className="theme-input mt-1 w-full rounded border px-3 py-2 text-sm"
              >
                {classGroups.map((cg) => (
                  <option key={cg.id} value={cg.id}>
                    {cg.course.name} — Início {typeof cg.startDate === "string" ? new Date(cg.startDate).toLocaleDateString("pt-BR") : ""} — {cg.startTime}-{cg.endTime}
                    {Array.isArray(cg.daysOfWeek) && cg.daysOfWeek.length ? ` — ${cg.daysOfWeek.join(", ")}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="theme-input mt-1 w-full rounded border px-3 py-2 text-sm"
              >
                <option value="ACTIVE">Ativa</option>
                <option value="SUSPENDED">Suspensa</option>
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
                    <p className="text-xs text-[var(--text-muted)]">Ou selecione um novo arquivo para substituir:</p>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-xs text-[var(--text-muted)]">Nenhum certificado anexado.</p>
              )}
              {!editRemovingCert && (
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/jpg,image/png"
                  className="mt-1 w-full text-sm"
                  onChange={(e) => setEditCertFile(e.target.files?.[0] ?? null)}
                />
              )}
              <p className="mt-1 text-xs text-[var(--text-muted)]">PDF ou imagem, máx. 5MB.</p>
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
