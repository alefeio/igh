/** Nome exibido para resposta oficial (professor ou admin/master). */
export function mapStaffOrTeacherReplyName(r: {
  teacher: { name: string } | null;
  staffUser: { name: string } | null;
}): string {
  return r.teacher?.name ?? r.staffUser?.name ?? "Equipe";
}
