import { mapStaffOrTeacherReplyName } from "@/lib/course-forum-reply-display";

type QuestionWithRelations = {
  id: string;
  content: string;
  imageUrls?: string[];
  createdAt: Date;
  updatedAt: Date;
  enrollmentId: string | null;
  enrollment: { student: { name: string } } | null;
  teacherAuthor?: { name: string } | null;
  replies?: Array<{
    id: string;
    content: string;
    createdAt: Date;
    enrollmentId: string;
    enrollment: { student: { name: string } };
  }>;
  teacherReplies?: Array<{
    id: string;
    content: string;
    createdAt: Date;
    teacher: { name: string } | null;
    staffUser: { name: string } | null;
  }>;
};

export function serializeForumQuestion(q: QuestionWithRelations) {
  return {
    id: q.id,
    content: q.content,
    imageUrls: q.imageUrls ?? [],
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
    enrollmentId: q.enrollmentId,
    authorName: q.teacherAuthor?.name ?? q.enrollment?.student.name ?? "Professor",
    authorRole: q.teacherAuthor ? "TEACHER" : "STUDENT",
    replies: (q.replies ?? []).map((r) => ({
      id: r.id,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
      enrollmentId: r.enrollmentId,
      authorName: r.enrollment.student.name,
    })),
    teacherReplies: (q.teacherReplies ?? []).map((r) => ({
      id: r.id,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
      teacherName: mapStaffOrTeacherReplyName(r),
    })),
  };
}
