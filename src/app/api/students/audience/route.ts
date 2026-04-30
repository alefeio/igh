import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
// Não importamos filtros/busca aqui: perfil geral não depende de filtros da tela.

function ageFromBirthDate(birthDate: Date, now = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}

type Bucket = { key: string; label: string; count: number; pct: number };

function toBuckets<T extends string | null | undefined>(
  total: number,
  rows: Array<{ key: T; count: number }>,
  labelFor: (k: string) => string
): Bucket[] {
  const out: Bucket[] = [];
  for (const r of rows) {
    const key = String(r.key ?? "").trim();
    if (!key) continue;
    const count = Number(r.count ?? 0) || 0;
    if (count <= 0) continue;
    out.push({
      key,
      label: labelFor(key),
      count,
      pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

function countAllFromGroupByRow(row: any): number {
  const c = row?._count;
  if (!c || c === true) return 0;
  const n = typeof c._all === "number" ? c._all : 0;
  return Number.isFinite(n) ? n : 0;
}

function labelGender(k: string) {
  const map: Record<string, string> = {
    MALE: "Masculino",
    FEMALE: "Feminino",
    OTHER: "Outro",
    PREFER_NOT_SAY: "Prefiro não dizer",
  };
  return map[k] ?? k;
}

function labelEducation(k: string) {
  const map: Record<string, string> = {
    NONE: "Nenhuma",
    ELEMENTARY_INCOMPLETE: "Fundamental incompleto",
    ELEMENTARY_COMPLETE: "Fundamental completo",
    HIGH_INCOMPLETE: "Médio incompleto",
    HIGH_COMPLETE: "Médio completo",
    COLLEGE_INCOMPLETE: "Superior incompleto",
    COLLEGE_COMPLETE: "Superior completo",
    OTHER: "Outro",
  };
  return map[k] ?? k;
}

function labelStudyShift(k: string) {
  const map: Record<string, string> = {
    MORNING: "Manhã",
    AFTERNOON: "Tarde",
    EVENING: "Noite",
    FULL: "Integral",
  };
  return map[k] ?? k;
}

function labelIdentity(k: string) {
  return k;
}

export async function GET(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "TEACHER", "COORDINATOR"]);

  const where: Prisma.StudentWhereInput = {};
  // Perfil geral: não depende de filtros da tela. Considera base ativa.
  where.deletedAt = null;

  let teacherStudentIds: string[] | null = null;
  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      return jsonOk({
        total: 0,
        gender: [],
        age: [],
        neighborhood: [],
        city: [],
        state: [],
        educationLevel: [],
        studyShift: [],
      });
    }
    const enrollments = await prisma.enrollment.findMany({
      where: { classGroup: { teacherId: teacher.id } },
      select: { studentId: true },
      distinct: ["studentId"],
    });
    teacherStudentIds = enrollments.map((e) => e.studentId);
    if (teacherStudentIds.length === 0) {
      return jsonOk({
        total: 0,
        gender: [],
        age: [],
        neighborhood: [],
        city: [],
        state: [],
        educationLevel: [],
        studyShift: [],
      });
    }
  }

  if (teacherStudentIds) {
    where.id = { in: teacherStudentIds };
  }

  const total = await prisma.student.count({ where });
  if (total === 0) {
    return jsonOk({
      total: 0,
      gender: [],
      age: [],
      neighborhood: [],
      city: [],
      state: [],
      educationLevel: [],
      studyShift: [],
    });
  }

  const [genderGb, neighborhoodGb, cityGb, stateGb, educationGb, shiftGb, birthDates] =
    await prisma.$transaction([
      prisma.student.groupBy({
        by: ["gender"],
        where,
        orderBy: { gender: "asc" },
        _count: { _all: true },
      }),
      prisma.student.groupBy({
        by: ["neighborhood"],
        where,
        orderBy: { neighborhood: "asc" },
        _count: { _all: true },
      }),
      prisma.student.groupBy({
        by: ["city"],
        where,
        orderBy: { city: "asc" },
        _count: { _all: true },
      }),
      prisma.student.groupBy({
        by: ["state"],
        where,
        orderBy: { state: "asc" },
        _count: { _all: true },
      }),
      prisma.student.groupBy({
        by: ["educationLevel"],
        where,
        orderBy: { educationLevel: "asc" },
        _count: { _all: true },
      }),
      prisma.student.groupBy({
        by: ["studyShift"],
        where,
        orderBy: { studyShift: "asc" },
        _count: { _all: true },
      }),
      prisma.student.findMany({
        where,
        select: { birthDate: true },
      }),
    ]);

  const gender = toBuckets(
    total,
    genderGb.map((r) => ({ key: r.gender as unknown as string, count: countAllFromGroupByRow(r) })),
    labelGender
  );
  const neighborhood = toBuckets(
    total,
    neighborhoodGb.map((r) => ({ key: (r.neighborhood as unknown as string) ?? "", count: countAllFromGroupByRow(r) })),
    labelIdentity
  ).filter((b) => b.key.trim().length > 0);
  const city = toBuckets(
    total,
    cityGb.map((r) => ({ key: (r.city as unknown as string) ?? "", count: countAllFromGroupByRow(r) })),
    labelIdentity
  );
  const state = toBuckets(
    total,
    stateGb.map((r) => ({ key: (r.state as unknown as string) ?? "", count: countAllFromGroupByRow(r) })),
    labelIdentity
  );
  const educationLevel = toBuckets(
    total,
    educationGb.map((r) => ({ key: r.educationLevel as unknown as string, count: countAllFromGroupByRow(r) })),
    labelEducation
  );
  const studyShift = toBuckets(
    total,
    shiftGb.map((r) => ({ key: (r.studyShift as unknown as string) ?? "", count: countAllFromGroupByRow(r) })),
    labelStudyShift
  );

  const ages = birthDates
    .map((r) => (r.birthDate ? ageFromBirthDate(r.birthDate) : null))
    .filter((a): a is number => typeof a === "number" && Number.isFinite(a) && a >= 0 && a <= 120);

  const ageBucketsRaw: Array<{ key: string; label: string; count: number }> = [
    { key: "0-17", label: "0–17", count: 0 },
    { key: "18-24", label: "18–24", count: 0 },
    { key: "25-34", label: "25–34", count: 0 },
    { key: "35-44", label: "35–44", count: 0 },
    { key: "45-59", label: "45–59", count: 0 },
    { key: "60+", label: "60+", count: 0 },
  ];
  for (const a of ages) {
    if (a <= 17) ageBucketsRaw[0]!.count++;
    else if (a <= 24) ageBucketsRaw[1]!.count++;
    else if (a <= 34) ageBucketsRaw[2]!.count++;
    else if (a <= 44) ageBucketsRaw[3]!.count++;
    else if (a <= 59) ageBucketsRaw[4]!.count++;
    else ageBucketsRaw[5]!.count++;
  }
  const age = ageBucketsRaw
    .filter((b) => b.count > 0)
    .map((b) => ({
      key: b.key,
      label: b.label,
      count: b.count,
      pct: total > 0 ? Math.round((b.count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return jsonOk({
    total,
    gender: gender.slice(0, 6),
    age: age.slice(0, 6),
    neighborhood: neighborhood.slice(0, 8),
    city: city.slice(0, 6),
    state: state.slice(0, 6),
    educationLevel: educationLevel.slice(0, 8),
    studyShift: studyShift.slice(0, 6),
  });
}

