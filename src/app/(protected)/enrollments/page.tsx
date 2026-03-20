"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart, Bar, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import * as XLSX from "xlsx";

import { StudentForm } from "@/components/students/StudentForm";
import { buildEnrollmentPdfBlob } from "@/lib/enrollment-pdf";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  SUSPENDED: "Suspensa",
  CANCELLED: "Cancelada",
  COMPLETED: "Concluída",
};
const ENROLLMENT_STATUS_TONE: Record<string, "zinc" | "green" | "red" | "blue" | "amber"> = {
  ACTIVE: "green",
  SUSPENDED: "amber",
  CANCELLED: "red",
  COMPLETED: "blue",
};

const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1";
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_CERT_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

type Student = { id: string; name: string; email: string | null; phone?: string | null };
type Course = { id: string; name: string };
type Teacher = { id: string; name: string };
type ClassGroup = {
  id: string;
  startDate: string;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  capacity?: number;
  location?: string | null;
  course: Course;
  teacher?: Teacher;
  status?: string;
  enrollmentsCount?: number;
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

/** Formata data apenas (YYYY-MM-DD ou ISO) como DD/MM/YYYY sem conversão de fuso (evita 18/03 virar 17/03). */
function formatDateOnly(value: string | Date | null | undefined): string {
  if (value == null) return "";
  const s = typeof value === "string" ? value : value.toISOString();
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return "";
}

/** Retorna URL do WhatsApp (wa.me) para o número; assume Brasil (55) se tiver 10–11 dígitos. */
function whatsappUrl(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 10) return "#";
  const full = d.length === 11 ? `55${d}` : d.length === 10 ? `55${d}` : `55${d.slice(-11)}`;
  return `https://wa.me/${full}`;
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
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [studentId, setStudentId] = useState("");
  const [classGroupId, setClassGroupId] = useState("");
  const [createCertFile, setCreateCertFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportExcelOpen, setExportExcelOpen] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  type ExcelColumnKey =
    | "aluno"
    | "curso"
    | "cursoTurma"
    | "telefone"
    | "email"
    | "professor"
    | "status"
    | "dataMatricula";

  const [excelColumns, setExcelColumns] = useState<Record<ExcelColumnKey, boolean>>({
    aluno: true,
    curso: false,
    cursoTurma: true,
    telefone: false,
    email: false,
    professor: false,
    status: false,
    dataMatricula: true,
  });

  const [openNewStudent, setOpenNewStudent] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);
  const studentComboboxRef = useRef<HTMLDivElement>(null);
  const [listFilter, setListFilter] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [statusFilterState, setStatusFilterState] = useState("");
  const [preEnrollmentFilterState, setPreEnrollmentFilterState] = useState<"" | "pre" | "confirmed">("");
  const [turmaFilterId, setTurmaFilterId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showTeacherDetails, setShowTeacherDetails] = useState(false);
  const [expandedCourseIds, setExpandedCourseIds] = useState<Set<string>>(new Set());
  const toggleCourseDetails = useCallback((courseId: string) => {
    setExpandedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [enrollmentsRes, teachersRes] = await Promise.all([
        fetch("/api/enrollments", { cache: "no-store" }),
        fetch("/api/teachers?status=active", { cache: "no-store" }),
      ]);
      const enrollmentsJson = await parseJson<{ enrollments: Enrollment[] }>(enrollmentsRes);
      const teachersJson = await parseJson<{ teachers: { id: string; name: string }[] }>(teachersRes);
      if (enrollmentsRes.ok && enrollmentsJson?.ok) setItems(enrollmentsJson.data.enrollments);
      else toast.push("error", "Falha ao carregar matrículas.");
      const teachersList = teachersJson?.ok && Array.isArray(teachersJson.data?.teachers)
        ? teachersJson.data.teachers.map((t) => ({ id: t.id, name: t.name }))
        : [];
      setAllTeachers(teachersList);
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
  }, [listFilter, pageSize, statusFilterState, preEnrollmentFilterState, turmaFilterId, dateFrom, dateTo]);

  /** Matrículas no intervalo de datas (quando informado); senão todas. Usado em dashboard, listagem e exportações. */
  const itemsForView = useMemo(() => {
    if (!dateFrom && !dateTo) return items;
    return items.filter((e) => {
      const d = new Date(e.enrolledAt).toISOString().slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [items, dateFrom, dateTo]);

  const dashboard = useMemo(() => {
    const list = itemsForView;
    const byClassGroup = new Map<string, { classGroup: ClassGroup; count: number }>();
    for (const e of list) {
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
      row.turmas.sort((a, b) => {
        const d = String(a.classGroup.startDate).localeCompare(String(b.classGroup.startDate));
        if (d !== 0) return d;
        return (a.classGroup.startTime || "").localeCompare(b.classGroup.startTime || "");
      });
    }
    const courses = Array.from(byCourse.entries()).sort((a, b) =>
      a[1].courseName.localeCompare(b[1].courseName)
    );
    const totalCapacity = Array.from(byClassGroup.values()).reduce(
      (sum, { classGroup }) => sum + (classGroup.capacity ?? 0),
      0
    );

    const byTeacher = new Map<string, { teacher: Teacher; turmas: { classGroup: ClassGroup; count: number }[] }>();
    for (const e of list) {
      if (e.status !== "ACTIVE") continue;
      const teacher = e.classGroup.teacher;
      if (!teacher) continue;
      const tid = teacher.id;
      if (!byTeacher.has(tid)) byTeacher.set(tid, { teacher, turmas: [] });
      const rec = byTeacher.get(tid)!;
      const cg = e.classGroup;
      const existing = rec.turmas.find((t) => t.classGroup.id === cg.id);
      if (existing) existing.count++;
      else rec.turmas.push({ classGroup: cg, count: 1 });
    }
    for (const rec of byTeacher.values()) {
      rec.turmas.sort((a, b) => {
        const d = String(a.classGroup.startDate).localeCompare(String(b.classGroup.startDate));
        if (d !== 0) return d;
        return (a.classGroup.startTime || "").localeCompare(b.classGroup.startTime || "");
      });
    }
    const teachers = Array.from(byTeacher.values())
      .map((r) => ({ ...r, totalAlunos: r.turmas.reduce((s, t) => s + t.count, 0) }))
      .sort((a, b) => a.teacher.name.localeCompare(b.teacher.name, "pt-BR"));

    return { courses, teachers, total: list.length, totalCapacity };
  }, [itemsForView]);

  /** Lista de professores para exibir: da API ou, se vazia, únicos que aparecem nas matrículas (no intervalo). */
  const teachersToDisplay = useMemo(() => {
    if (allTeachers.length > 0) return allTeachers;
    const seen = new Map<string, Teacher>();
    for (const e of itemsForView) {
      const t = e.classGroup.teacher;
      if (t && !seen.has(t.id)) seen.set(t.id, t);
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [allTeachers, itemsForView]);

  const activeCountByClassGroup = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of itemsForView) {
      if (e.status !== "ACTIVE") continue;
      const id = e.classGroup.id;
      m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [itemsForView]);

  const kpis = useMemo(() => {
    const active = itemsForView.filter((e) => e.status === "ACTIVE").length;
    const pre = itemsForView.filter((e) => e.isPreEnrollment).length;
    const confirmed = itemsForView.filter((e) => e.enrollmentConfirmedAt != null).length;
    return { total: itemsForView.length, active, pre, confirmed };
  }, [itemsForView]);

  /** Normaliza string removendo acentos: permite digitar "Jose" e encontrar "José". */
  const normalizeForSearch = (s: string) =>
    String(s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const filteredItems = useMemo(() => {
    let list = itemsForView;
    const q = listFilter.trim();
    if (q.length > 0) {
      const qNorm = normalizeForSearch(q);
      list = list.filter(
        (e) =>
          normalizeForSearch(e.student.name).includes(qNorm) ||
          (e.student.email != null && normalizeForSearch(e.student.email).includes(qNorm)) ||
          normalizeForSearch(e.classGroup.course.name).includes(qNorm)
      );
    }
    if (statusFilterState) list = list.filter((e) => e.status === statusFilterState);
    if (preEnrollmentFilterState === "pre") list = list.filter((e) => e.isPreEnrollment);
    if (preEnrollmentFilterState === "confirmed") list = list.filter((e) => e.enrollmentConfirmedAt != null);
    if (turmaFilterId) list = list.filter((e) => e.classGroup.id === turmaFilterId);
    return list;
  }, [itemsForView, listFilter, statusFilterState, preEnrollmentFilterState, turmaFilterId]);

  const turmaOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [];
    for (const [, { courseName, turmas }] of dashboard.courses) {
      for (const { classGroup: cg } of turmas) {
        const start = formatDateOnly(cg.startDate).slice(0, 5);
        opts.push({
          id: cg.id,
          label: `${courseName} — ${start} ${cg.startTime}-${cg.endTime}`,
        });
      }
    }
    return opts;
  }, [dashboard.courses]);

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

  const columnData = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const e of itemsForView) {
      const d = formatDateOnly(e.enrolledAt);
      if (d) byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
    return [...byDay.entries()]
      .sort((a, b) => {
        const [da, db] = [a[0], b[0]].map((s) => {
          const [dd, mm, yyyy] = s.split("/");
          return new Date(Number(yyyy), Number(mm) - 1, Number(dd)).getTime();
        });
        return da - db;
      })
      .map(([data, quantidade]) => ({ data, quantidade }));
  }, [itemsForView]);

  const teacherChartData = useMemo(
    () =>
      teachersToDisplay
        .map((t) => {
          const found = dashboard.teachers.find((r) => r.teacher.id === t.id);
          return { professor: t.name, alunos: found?.totalAlunos ?? 0 };
        })
        .sort((a, b) => b.alunos - a.alunos),
    [teachersToDisplay, dashboard.teachers]
  );

  /** Por curso: totais (capacidade e alunos) e turmas para gráfico + detalhes. */
  const courseChartsData = useMemo(
    () =>
      dashboard.courses.map(([courseId, { courseName, turmas }]) => {
        const totalCapacidade = turmas.reduce((s, t) => s + (t.classGroup.capacity ?? 0), 0);
        const totalAlunos = turmas.reduce((s, t) => s + t.count, 0);
        return {
          courseId,
          courseName,
          totalCapacidade,
          totalAlunos,
          chartData: [{ curso: courseName, capacidade: totalCapacidade, alunos: totalAlunos }],
          turmas,
        };
      }),
    [dashboard.courses]
  );

  const PIE_COLORS = ["#0066b3", "#1a365d", "#e87500", "#0d9488", "#7c3aed", "#dc2626", "#65a30d", "#ca8a04"];

  function exportToExcel() {
    if (exportingExcel) return;
    if (filteredItems.length === 0) return;

    const selectedKeys = (Object.keys(excelColumns) as ExcelColumnKey[]).filter((k) => excelColumns[k]);
    if (selectedKeys.length === 0) {
      toast.push("error", "Selecione pelo menos uma coluna para exportar.");
      return;
    }

    setExportingExcel(true);
    try {
      const sorted = [...filteredItems].sort((a, b) => a.student.name.localeCompare(b.student.name, "pt-BR"));

      const rows = sorted.map((e) => {
        const row: Record<string, string> = {};
        for (const key of selectedKeys) {
          switch (key) {
            case "aluno":
              row["Aluno"] = e.student.name ?? "";
              break;
            case "curso":
              row["Curso"] = e.classGroup.course.name ?? "";
              break;
            case "cursoTurma":
              row["Curso/Turma"] = `${e.classGroup.course.name} — ${e.classGroup.startTime}-${e.classGroup.endTime}${Array.isArray(e.classGroup.daysOfWeek) && e.classGroup.daysOfWeek.length ? ` (${e.classGroup.daysOfWeek.join(", ")})` : ""}${e.classGroup.location ? ` — ${e.classGroup.location}` : ""}`;
              break;
            case "telefone":
              row["Telefone"] = e.student.phone ?? "";
              break;
            case "email":
              row["Email"] = e.student.email ?? "";
              break;
            case "professor":
              row["Professor"] = e.classGroup.teacher?.name ?? "";
              break;
            case "status":
              row["Status"] = ENROLLMENT_STATUS_LABELS[e.status] ?? e.status;
              break;
            case "dataMatricula":
              row["Data de início da turma"] = formatDateOnly(e.classGroup.startDate);
              break;
          }
        }
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Matrículas");
      XLSX.writeFile(wb, `matriculas_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.push("success", "Planilha exportada.");
      setExportExcelOpen(false);
    } catch {
      toast.push("error", "Falha ao exportar Excel.");
    } finally {
      setExportingExcel(false);
    }
  }

  async function exportToPdf() {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const teachersForPdf = teachersToDisplay
        .map((t) => {
          const found = dashboard.teachers.find((r) => r.teacher.id === t.id);
          return found ?? { teacher: t, turmas: [], totalAlunos: 0 };
        })
        .sort((a, b) => a.teacher.name.localeCompare(b.teacher.name, "pt-BR"));
      const blob = await buildEnrollmentPdfBlob({
        kpis,
        pieData,
        columnData,
        courses: dashboard.courses,
        teachersData: teachersForPdf,
        formatDateOnly,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `matriculas_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.push("success", "PDF exportado.");
    } catch {
      toast.push("error", "Falha ao gerar PDF.");
    } finally {
      setExportingPdf(false);
    }
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
    if (!isMaster) {
      const cg = classGroups.find((c) => c.id === classGroupId);
      const count = cg?.enrollmentsCount ?? activeCountByClassGroup.get(classGroupId) ?? 0;
      const cap = cg?.capacity ?? 0;
      if (cap > 0 && count >= cap) {
        toast.push("error", "Esta turma está lotada. Escolha outra turma.");
        return;
      }
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
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <DashboardHero
        eyebrow="Matrículas"
        title="Matrículas"
        description="Análise por status, turma e data. Crie matrículas, confira vagas e exporte dados. E-mail de boas-vindas pode ser enviado ao aluno."
        rightSlot={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setExportExcelOpen(true)}
                disabled={filteredItems.length === 0}
              >
                Exportar Excel
              </Button>
              <Button variant="secondary" onClick={exportToPdf} disabled={exportingPdf || itemsForView.length === 0}>
                {exportingPdf ? "Gerando PDF…" : "Exportar PDF"}
              </Button>
            </div>
            {(user.role === "ADMIN" || user.role === "MASTER") && (
              <Button onClick={openCreate} className="w-full sm:w-auto">
                Nova matrícula
              </Button>
            )}
          </div>
        }
      />

      {loading ? (
        <div
          className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-12 text-center text-[var(--text-muted)]"
          role="status"
        >
          Carregando matrículas...
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <SectionCard
            id="enrollments-date-filter-heading"
            title="Filtrar por data de matrícula"
            description="O intervalo aplica-se a toda a página: resumo, gráficos, vagas por curso e listagem."
            variant="elevated"
          >
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="enrollments-date-from" className="block text-xs font-medium text-[var(--text-muted)] mb-0.5">
                  De
                </label>
                <Input
                  id="enrollments-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="min-w-[140px]"
                />
              </div>
              <div>
                <label htmlFor="enrollments-date-to" className="block text-xs font-medium text-[var(--text-muted)] mb-0.5">
                  Até
                </label>
                <Input
                  id="enrollments-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="min-w-[140px]"
                />
              </div>
              {(dateFrom || dateTo) && (
                <Button type="button" variant="secondary" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                  Limpar datas
                </Button>
              )}
            </div>
          </SectionCard>

          {kpis.pre > 0 && isMaster && (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30"
              role="status"
            >
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {kpis.pre} pré-matrícula{kpis.pre !== 1 ? "s" : ""} aguardando confirmação.
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  setPreEnrollmentFilterState("pre");
                  setStatusFilterState("");
                  setTurmaFilterId("");
                }}
              >
                Filtrar e confirmar
              </Button>
            </div>
          )}

          <section aria-labelledby="enrollments-kpis-heading" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <h2 id="enrollments-kpis-heading" className="sr-only">
              Resumo de matrículas
            </h2>
            <button
              type="button"
              onClick={() => { setStatusFilterState(""); setPreEnrollmentFilterState(""); setTurmaFilterId(""); }}
              className={`rounded-lg border p-4 text-left transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                !statusFilterState && !preEnrollmentFilterState && !turmaFilterId
                  ? "border-[var(--igh-primary)]/50 bg-[var(--igh-primary)]/5"
                  : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--igh-primary)]/30"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Total</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{kpis.total}</p>
            </button>
            <button
              type="button"
              onClick={() => { setStatusFilterState("ACTIVE"); setPreEnrollmentFilterState(""); setTurmaFilterId(""); }}
              className={`rounded-lg border p-4 text-left transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                statusFilterState === "ACTIVE" && !preEnrollmentFilterState && !turmaFilterId
                  ? "border-green-500/50 bg-green-500/5"
                  : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--igh-primary)]/30"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Ativas</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{kpis.active}</p>
            </button>
            <button
              type="button"
              onClick={() => { setPreEnrollmentFilterState("pre"); setStatusFilterState(""); setTurmaFilterId(""); }}
              className={`rounded-lg border p-4 text-left transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                preEnrollmentFilterState === "pre"
                  ? "border-amber-500/50 bg-amber-500/5"
                  : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--igh-primary)]/30"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Pré-matrículas</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{kpis.pre}</p>
            </button>
            <button
              type="button"
              onClick={() => { setPreEnrollmentFilterState("confirmed"); setStatusFilterState(""); setTurmaFilterId(""); }}
              className={`rounded-lg border p-4 text-left transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                preEnrollmentFilterState === "confirmed"
                  ? "border-[var(--igh-primary)]/50 bg-[var(--igh-primary)]/5"
                  : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--igh-primary)]/30"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Confirmadas</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{kpis.confirmed}</p>
            </button>
          </section>

          {(pieData.length > 0 || columnData.length > 0) && (
            <SectionCard
              id="enrollments-charts-heading"
              title="Análise visual"
              description="Distribuição por curso e por data de matrícula."
              variant="elevated"
            >
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
                            wrapperStyle={{
                              backgroundColor: "var(--card-bg)",
                              border: "1px solid var(--card-border)",
                              borderRadius: "8px",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                            }}
                            contentStyle={{
                              backgroundColor: "var(--card-bg)",
                              border: "none",
                              borderRadius: "8px",
                              color: "var(--text-primary)",
                            }}
                            labelStyle={{ color: "var(--text-primary)" }}
                            itemStyle={{ color: "var(--text-primary)" }}
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
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis
                            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                            stroke="var(--card-border)"
                            allowDecimals={false}
                          />
                          <Tooltip
                            formatter={(value: number | undefined) => [value ?? 0, "Matrículas"]}
                            wrapperStyle={{
                              backgroundColor: "var(--card-bg)",
                              border: "1px solid var(--card-border)",
                              borderRadius: "8px",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                            }}
                            contentStyle={{
                              backgroundColor: "var(--card-bg)",
                              border: "none",
                              borderRadius: "8px",
                              color: "var(--text-primary)",
                            }}
                            labelStyle={{ color: "var(--text-primary)" }}
                            itemStyle={{ color: "var(--text-primary)" }}
                          />
                          <Bar dataKey="quantidade" fill="var(--igh-primary)" radius={[4, 4, 0, 0]} name="Matrículas" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          <SectionCard
            id="enrollments-summary-heading"
            title="Vagas por curso e turma"
            description="Total de capacidade (azul) e de alunos (vermelho) por curso. Use o botão em cada gráfico para ver detalhes por turma."
            variant="elevated"
          >
            {dashboard.courses.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-secondary)]">Nenhuma matrícula para exibir.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {courseChartsData.map(({ courseId, courseName, chartData, turmas }) => (
                    <div
                      key={courseId}
                      className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-4"
                    >
                      <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">{courseName}</h3>
                      <div className="h-[180px] w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <XAxis
                              dataKey="curso"
                              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                              interval={0}
                              tickFormatter={() => ""}
                            />
                            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "var(--card-bg)",
                                border: "1px solid var(--card-border)",
                                borderRadius: "6px",
                              }}
                              labelStyle={{ color: "var(--text-primary)" }}
                              formatter={(value: number | undefined, name?: string) => [value ?? 0, name === "capacidade" ? "Capacidade" : "Alunos"]}
                              labelFormatter={() => courseName}
                            />
                            <Legend
                              wrapperStyle={{ fontSize: "11px" }}
                              formatter={(value) => (value === "capacidade" ? "Capacidade" : "Alunos")}
                            />
                            <Bar dataKey="capacidade" fill="#2563eb" radius={[4, 4, 0, 0]} name="capacidade" />
                            <Bar dataKey="alunos" fill="#dc2626" radius={[4, 4, 0, 0]} name="alunos" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => toggleCourseDetails(courseId)}
                        className="mt-2 w-full"
                      >
                        {expandedCourseIds.has(courseId) ? "Ocultar detalhes" : "Exibir detalhes"}
                      </Button>
                      {expandedCourseIds.has(courseId) && (
                        <ul className="mt-3 list-none space-y-1.5 border-t border-[var(--card-border)] pt-3 text-sm text-[var(--text-secondary)]">
                          {turmas.length === 0 ? (
                            <li className="text-[var(--text-muted)]">Nenhuma turma no momento.</li>
                          ) : (
                            turmas.map(({ classGroup: cg, count }) => {
                              const start = formatDateOnly(cg.startDate).slice(0, 5);
                              const days = Array.isArray(cg.daysOfWeek) ? cg.daysOfWeek.join(", ") : "";
                              const label = `Início ${start} — ${cg.startTime}-${cg.endTime}${days ? ` • ${days}` : ""}${cg.location ? ` — ${cg.location}` : ""}`;
                              const cap = cg.capacity != null ? cg.capacity : 0;
                              const fechada = cap > 0 && count >= cap;
                              return (
                                <li key={cg.id} className="flex flex-wrap items-center justify-between gap-2">
                                  <span>
                                    {label}:{" "}
                                    <strong
                                      className={fechada ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}
                                    >
                                      {count} / {cap || "—"}
                                    </strong>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTurmaFilterId(cg.id);
                                      document.getElementById("enrollments-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
                                    }}
                                    className="text-xs font-medium text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
                                  >
                                    Ver listagem
                                  </button>
                                </li>
                              );
                            })
                          )}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-[var(--card-border)] pt-3">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Total de matrículas: </span>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {dashboard.total}
                    {dashboard.totalCapacity > 0 ? ` / ${dashboard.totalCapacity}` : ""}
                  </span>
                </div>
              </>
            )}
          </SectionCard>

          <SectionCard
            id="enrollments-by-teacher-heading"
            title="Por professor"
            description="Quantidade de alunos (matrículas ativas) por professor. Use o botão abaixo para ver turmas e listagens."
            variant="elevated"
          >
              {teachersToDisplay.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">Nenhum professor cadastrado.</p>
              ) : (
                <>
                  {teacherChartData.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Alunos por professor</h3>
                      <div className="h-[280px] w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={teacherChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <XAxis
                              dataKey="professor"
                              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                              interval={0}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "var(--card-bg)",
                                border: "1px solid var(--card-border)",
                                borderRadius: "6px",
                              }}
                              labelStyle={{ color: "var(--text-primary)" }}
                              formatter={(value: number | undefined) => [value ?? 0, "Alunos"]}
                              labelFormatter={(label) => `Professor: ${label}`}
                            />
                            <Bar dataKey="alunos" fill="var(--igh-primary)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowTeacherDetails((v) => !v)}
                    className="mb-4"
                  >
                    {showTeacherDetails ? "Ocultar detalhes" : "Exibir detalhes"}
                  </Button>
                  {showTeacherDetails && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {teachersToDisplay
                    .map((t) => {
                      const found = dashboard.teachers.find((r) => r.teacher.id === t.id);
                      return found ?? { teacher: t, turmas: [], totalAlunos: 0 };
                    })
                    .sort((a, b) => a.teacher.name.localeCompare(b.teacher.name, "pt-BR"))
                    .map(({ teacher, turmas, totalAlunos }) => {
                    const byCourse = new Map<string, { courseName: string; turmas: { classGroup: ClassGroup; count: number }[] }>();
                    for (const t of turmas) {
                      const cid = t.classGroup.course.id;
                      const name = t.classGroup.course.name;
                      if (!byCourse.has(cid)) byCourse.set(cid, { courseName: name, turmas: [] });
                      byCourse.get(cid)!.turmas.push(t);
                    }
                    const courseEntries = Array.from(byCourse.entries()).sort((a, b) =>
                      a[1].courseName.localeCompare(b[1].courseName)
                    );
                    return (
                      <div
                        key={teacher.id}
                        className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-4"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="font-medium text-[var(--text-primary)]">{teacher.name}</h3>
                          <span className="text-sm font-semibold text-[var(--igh-primary)]">
                            Total: {totalAlunos} {totalAlunos === 1 ? "aluno" : "alunos"}
                          </span>
                        </div>
                        <div className="mt-3 space-y-4 text-sm text-[var(--text-secondary)]">
                          {courseEntries.length === 0 ? (
                            <p className="text-[var(--text-muted)]">Nenhuma turma no momento.</p>
                          ) : (
                          courseEntries.map(([courseId, { courseName, turmas: courseTurmas }]) => (
                            <div key={courseId}>
                              <div className="font-medium text-[var(--text-primary)]">{courseName}</div>
                              <div className="mt-1.5 pl-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                                Turmas
                              </div>
                              <ul className="mt-1 list-none space-y-2">
                                {courseTurmas.map(({ classGroup: cg, count }) => {
                                  const start = formatDateOnly(cg.startDate).slice(0, 5);
                                  const days = Array.isArray(cg.daysOfWeek) ? cg.daysOfWeek.join(", ") : "";
                                  const label = `Início ${start} — ${cg.startTime}-${cg.endTime}${days ? ` • ${days}` : ""}${cg.location ? ` — ${cg.location}` : ""}`;
                                  return (
                                    <li key={cg.id} className="rounded border border-[var(--card-border)] bg-[var(--card-bg)] p-2">
                                      <div className="text-[var(--text-primary)]">{label}</div>
                                      <div className="mt-1 flex items-center justify-between gap-2">
                                        <span className="text-[var(--text-secondary)]">
                                          {count} {count === 1 ? "aluno" : "alunos"}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setTurmaFilterId(cg.id);
                                            document.getElementById("enrollments-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
                                          }}
                                          className="text-xs font-medium text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
                                        >
                                          Ver listagem
                                        </button>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                  )}
                </>
              )}
          </SectionCard>

          <section id="enrollments-list" className="card scroll-mt-4" aria-labelledby="enrollments-list-heading">
            <header className="card-header flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-0 flex-1">
                <h2 id="enrollments-list-heading" className="text-base font-semibold text-[var(--text-primary)]">
                  Listagem de matrículas
                </h2>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                  {totalFiltered === 0
                    ? "Nenhuma matrícula na listagem"
                    : `Exibindo ${totalFiltered} matrícula(s)`}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                {(listFilter || statusFilterState || preEnrollmentFilterState || turmaFilterId || dateFrom || dateTo) && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setListFilter("");
                      setStatusFilterState("");
                      setPreEnrollmentFilterState("");
                      setTurmaFilterId("");
                      setDateFrom("");
                      setDateTo("");
                    }}
                  >
                    Limpar filtros
                  </Button>
                )}
                <div className="min-w-[200px]">
                  <label htmlFor="enrollments-list-filter" className="sr-only">
                    Buscar por nome, e-mail ou curso
                  </label>
                  <Input
                    id="enrollments-list-filter"
                    type="search"
                    value={listFilter}
                    onChange={(e) => setListFilter(e.target.value)}
                    placeholder="Nome, e-mail ou curso..."
                    className="w-full"
                  />
                </div>
                <div>
                  <label htmlFor="enrollments-status-filter" className="sr-only">
                    Status
                  </label>
                  <select
                    id="enrollments-status-filter"
                    value={statusFilterState}
                    onChange={(e) => setStatusFilterState(e.target.value)}
                    className="theme-input min-h-[44px] rounded-md border px-3 py-2 text-sm sm:h-10"
                  >
                    <option value="">Todos os status</option>
                    {Object.entries(ENROLLMENT_STATUS_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="enrollments-pre-filter" className="sr-only">
                    Tipo de matrícula
                  </label>
                  <select
                    id="enrollments-pre-filter"
                    value={preEnrollmentFilterState}
                    onChange={(e) => setPreEnrollmentFilterState((e.target.value || "") as "" | "pre" | "confirmed")}
                    className="theme-input min-h-[44px] rounded-md border px-3 py-2 text-sm sm:h-10"
                  >
                    <option value="">Todas</option>
                    <option value="pre">Só pré-matrículas</option>
                    <option value="confirmed">Só confirmadas</option>
                  </select>
                </div>
                {turmaOptions.length > 0 && (
                  <div className="min-w-[200px]">
                    <label htmlFor="enrollments-turma-filter" className="sr-only">
                      Turma
                    </label>
                    <select
                      id="enrollments-turma-filter"
                      value={turmaFilterId}
                      onChange={(e) => setTurmaFilterId(e.target.value)}
                      className="theme-input min-h-[44px] w-full rounded-md border px-3 py-2 text-sm sm:h-10"
                    >
                      <option value="">Todas as turmas</option>
                      {turmaOptions.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label htmlFor="enrollments-page-size" className="sr-only">
                    Registros por página
                  </label>
                  <select
                    id="enrollments-page-size"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="theme-input min-h-[44px] rounded-md border px-3 py-2 text-sm sm:h-10"
                  >
                    <option value={20}>20 por página</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                  </select>
                </div>
              </div>
            </header>
            <div className="card-body overflow-x-auto">
            <Table>
          <thead>
            <tr>
              <Th>Aluno</Th>
              <Th>Curso / Turma</Th>
              <Th>Início da turma</Th>
              <Th>Status</Th>
              <Th>Dados completos</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((e) => (
              <tr key={e.id}>
                <Td>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-[var(--text-primary)]">{e.student.name}</div>
                      {(e.student.phone ?? "").replace(/\D/g, "").length >= 10 ? (
                        <a
                          href={whatsappUrl(e.student.phone ?? "")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded bg-[var(--igh-primary)] p-1 text-white hover:opacity-90"
                          title="Abrir no WhatsApp"
                          aria-label="Abrir no WhatsApp"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                          </svg>
                        </a>
                      ) : null}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">{e.student.email ?? "—"}</div>
                  </div>
                </Td>
                <Td>
                  <div>
                    <div className="text-[var(--text-primary)]">{e.classGroup.course.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {e.classGroup.startTime}–{e.classGroup.endTime}
                      {Array.isArray(e.classGroup.daysOfWeek) && e.classGroup.daysOfWeek.length
                        ? ` • ${e.classGroup.daysOfWeek.join(", ")}`
                        : ""}
                    </div>
                    {e.classGroup.location && (
                      <div className="text-xs text-[var(--text-muted)]">Local: {e.classGroup.location}</div>
                    )}
                  </div>
                </Td>
                <Td>{formatDateOnly(e.classGroup.startDate)}</Td>
                <Td>
                  <span className="flex flex-wrap items-center gap-1">
                    <Badge tone={ENROLLMENT_STATUS_TONE[e.status] ?? "zinc"}>
                      {ENROLLMENT_STATUS_LABELS[e.status] ?? e.status}
                    </Badge>
                    {e.isPreEnrollment && (
                      <Badge tone="amber">Pré-matrícula</Badge>
                    )}
                  </span>
                </Td>
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
                <Td colSpan={6} className="py-10">
                  <div
                    className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-8 text-center"
                    role="status"
                  >
                    <p className="text-sm text-[var(--text-muted)]">
                      {items.length === 0
                        ? "Nenhuma matrícula cadastrada. Use «Nova matrícula» para começar."
                        : "Nenhuma matrícula encontrada com os filtros aplicados. Tente alterar ou limpar os filtros."}
                    </p>
                  </div>
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--card-border)] px-3 py-3 sm:px-4">
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
                  const q = studentSearchQuery.trim();
                  const qNorm = q.length > 0 ? normalizeForSearch(q) : "";
                  const filtered =
                    qNorm.length === 0
                      ? students
                      : students.filter(
                          (s) =>
                            normalizeForSearch(s.name).includes(qNorm) ||
                            (s.email != null && normalizeForSearch(s.email).includes(qNorm))
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
              {classGroups
                .filter((cg) => {
                  const permiteMatriculaPadrao =
                    cg.status === "PLANEJADA" ||
                    cg.status === "ABERTA" ||
                    cg.status === "EM_ANDAMENTO";
                  const isInterno = cg.status === "INTERNO";
                  const isExterno = cg.status === "EXTERNO";
                  const canSeeExterno = user?.role === "ADMIN" || isMaster;
                  const permitidaParaMatricula =
                    permiteMatriculaPadrao || (isMaster && isInterno) || (canSeeExterno && isExterno);
                  if (!permitidaParaMatricula) return false;
                  return true;
                })
                .map((cg) => {
                  const cap = cg.capacity ?? 0;
                  const count = cg.enrollmentsCount ?? 0;
                  const isFull = cap > 0 && count >= cap;
                  const disabled = !isMaster && isFull;
                  const label = [
                    cg.course.name,
                    `Início ${formatDateOnly(cg.startDate)}`,
                    `${cg.startTime}-${cg.endTime}`,
                    Array.isArray(cg.daysOfWeek) && cg.daysOfWeek.length ? cg.daysOfWeek.join(", ") : null,
                    cg.location || null,
                  ]
                    .filter(Boolean)
                    .join(" — ");
                  return (
                    <option key={cg.id} value={cg.id} disabled={disabled}>
                      {label} — ({count} / {cap || "—"} vagas){isFull ? " — Lotada" : ""}
                    </option>
                  );
                })}
            </select>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Inscritos / capacidade. Turmas lotadas só podem receber mais alunos se você for Master.
            </p>
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
                {classGroups
                  .filter((cg) => {
                    const isCurrent = cg.id === editingEnrollment.classGroup.id;
                    const permiteMatriculaPadrao =
                      cg.status === "PLANEJADA" ||
                      cg.status === "ABERTA" ||
                      cg.status === "EM_ANDAMENTO";
                    const isInterno = cg.status === "INTERNO";
                    const isExterno = cg.status === "EXTERNO";
                    const canSeeExterno = user?.role === "ADMIN" || isMaster;
                    return (
                      permiteMatriculaPadrao ||
                      (isMaster && isInterno) ||
                      (canSeeExterno && isExterno) ||
                      isCurrent
                    );
                  })
                  .map((cg) => {
                    const isCurrent = cg.id === editingEnrollment.classGroup.id;
                    const cap = cg.capacity ?? 0;
                    const count = cg.enrollmentsCount ?? 0;
                    const isFull = cap > 0 && count >= cap;
                    const disabled = !isMaster && !isCurrent && isFull;
                    const label = [
                      cg.course.name,
                      `Início ${formatDateOnly(cg.startDate)}`,
                      `${cg.startTime}-${cg.endTime}`,
                      Array.isArray(cg.daysOfWeek) && cg.daysOfWeek.length ? cg.daysOfWeek.join(", ") : null,
                      cg.location || null,
                    ]
                      .filter(Boolean)
                      .join(" — ");
                    return (
                      <option key={cg.id} value={cg.id} disabled={disabled}>
                        {label} — ({count} / {cap || "—"} vagas){isFull ? " — Lotada" : ""}
                      </option>
                    );
                  })}
              </select>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Inscritos / capacidade. Só Master pode transferir para turma lotada.
              </p>
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

      <Modal
        open={exportExcelOpen}
        title="Exportar Excel"
        onClose={() => {
          setExportExcelOpen(false);
        }}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--text-muted)]">
            Serão exportadas <strong className="text-[var(--text-primary)]">{filteredItems.length}</strong> matrículas
            com os filtros atuais da tela.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={excelColumns.aluno}
                onChange={(e) => setExcelColumns((p) => ({ ...p, aluno: e.target.checked }))}
              />
              Nome do aluno
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={excelColumns.curso}
                onChange={(e) => setExcelColumns((p) => ({ ...p, curso: e.target.checked }))}
              />
              Curso
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={excelColumns.cursoTurma}
                onChange={(e) => setExcelColumns((p) => ({ ...p, cursoTurma: e.target.checked }))}
              />
              Curso/Turma
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={excelColumns.telefone}
                onChange={(e) => setExcelColumns((p) => ({ ...p, telefone: e.target.checked }))}
              />
              Telefone
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={excelColumns.email}
                onChange={(e) => setExcelColumns((p) => ({ ...p, email: e.target.checked }))}
              />
              Email
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={excelColumns.professor}
                onChange={(e) => setExcelColumns((p) => ({ ...p, professor: e.target.checked }))}
              />
              Professor
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={excelColumns.status}
                onChange={(e) => setExcelColumns((p) => ({ ...p, status: e.target.checked }))}
              />
              Status
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={excelColumns.dataMatricula}
                onChange={(e) => setExcelColumns((p) => ({ ...p, dataMatricula: e.target.checked }))}
              />
              Data de início da turma
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setExportExcelOpen(false)}
              disabled={exportingExcel}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={exportToExcel}
              disabled={exportingExcel || filteredItems.length === 0}
            >
              {exportingExcel ? "Exportando…" : "Exportar"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={openNewStudent} title="Cadastrar aluno" onClose={() => setOpenNewStudent(false)}>
        <StudentForm
          editing={null}
          onSuccess={handleNewStudentSuccess}
          onCancel={() => setOpenNewStudent(false)}
          isMaster={isMaster}
        />
      </Modal>
    </div>
  );
}
