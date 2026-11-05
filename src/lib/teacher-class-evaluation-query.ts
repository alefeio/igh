import "server-only";

import { prisma } from "@/lib/prisma";
import { teacherMaterialClassLabel } from "@/lib/teacher-class-material";
import {
  buildPublicTeacherEvaluationRanking,
  teacherClassEvaluationListWhere,
  teacherEvaluationAuthorLabel,
  type PublicTeacherEvaluationRanking,
  type TeacherEvaluationListFilter,
} from "@/lib/teacher-class-evaluation";

const evaluationSelect = {
  id: true,
  rating: true,
  comment: true,
  anonymous: true,
  createdAt: true,
  teacher: { select: { name: true } },
  enrollment: {
    select: {
      student: { select: { name: true } },
      classGroup: {
        select: {
          daysOfWeek: true,
          startTime: true,
          endTime: true,
          course: { select: { name: true } },
        },
      },
    },
  },
} as const;

export type TeacherClassEvaluationListItem = {
  id: string;
  rating: number;
  comment: string;
  anonymous: boolean;
  createdAt: string;
  authorLabel: string;
  courseName: string;
  classLabel: string;
  teacherName: string;
};

export type TeacherClassEvaluationListResult = {
  items: TeacherClassEvaluationListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function mapEvaluationRow(
  row: {
    id: string;
    rating: number;
    comment: string | null;
    anonymous: boolean;
    createdAt: Date;
    teacher: { name: string };
    enrollment: {
      student: { name: string };
      classGroup: {
        daysOfWeek: string[];
        startTime: string;
        endTime: string;
        course: { name: string };
      };
    };
  },
  options?: { revealIdentity?: boolean },
): TeacherClassEvaluationListItem {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment ?? "",
    anonymous: row.anonymous,
    createdAt: row.createdAt.toISOString(),
    authorLabel: teacherEvaluationAuthorLabel(row.anonymous, row.enrollment.student.name, options),
    courseName: row.enrollment.classGroup.course.name,
    classLabel: teacherMaterialClassLabel(row.enrollment.classGroup),
    teacherName: row.teacher.name,
  };
}

export async function listTeacherClassEvaluations(
  teacherId?: string,
  options?: {
    revealIdentity?: boolean;
    includeAnonymous?: boolean;
    filter?: TeacherEvaluationListFilter;
    page?: number;
    pageSize?: number;
  },
): Promise<TeacherClassEvaluationListResult> {
  const where = teacherClassEvaluationListWhere(teacherId, options);
  const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 200));
  const page = Math.max(1, options?.page ?? 1);
  const [total, rows] = await Promise.all([
    prisma.teacherClassEvaluation.count({ where }),
    prisma.teacherClassEvaluation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: evaluationSelect,
    }),
  ]);
  return {
    items: rows.map((row) => mapEvaluationRow(row, options)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listPublicTeacherEvaluationRanking(
  filter: TeacherEvaluationListFilter = {},
): Promise<PublicTeacherEvaluationRanking[]> {
  const rows = await prisma.teacherClassEvaluation.findMany({
    where: {
      ...teacherClassEvaluationListWhere(undefined, { filter }),
      teacher: { deletedAt: null },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      rating: true,
      comment: true,
      updatedAt: true,
      teacherId: true,
      teacher: { select: { name: true } },
      enrollment: {
        select: {
          student: { select: { name: true } },
          classGroup: {
            select: {
              daysOfWeek: true,
              startTime: true,
              endTime: true,
              course: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  return buildPublicTeacherEvaluationRanking(
    rows.map((row) => ({
      teacherId: row.teacherId,
      teacherName: row.teacher.name,
      rating: row.rating,
      comment: row.comment ?? "",
      at: row.updatedAt.toISOString(),
      authorLabel: teacherEvaluationAuthorLabel(false, row.enrollment.student.name),
      courseName: row.enrollment.classGroup.course.name,
      classLabel: teacherMaterialClassLabel(row.enrollment.classGroup),
    })),
  );
}

/** Exportação completa do recorte (sem paginação). Ranking público + avaliações da coordenação. */
export async function loadCoordinatorTeacherEvaluationExport(filter: TeacherEvaluationListFilter) {
  const [ranking, evaluations] = await Promise.all([
    listPublicTeacherEvaluationRanking(filter),
    listTeacherClassEvaluations(undefined, {
      revealIdentity: true,
      includeAnonymous: true,
      filter,
      page: 1,
      pageSize: 10000,
    }),
  ]);
  return { ranking, evaluations: evaluations.items, totalEvaluations: evaluations.total };
}
