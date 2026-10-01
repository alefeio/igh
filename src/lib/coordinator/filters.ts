export type CoordinatorScope = "all" | "internal" | "external";

export type CoordinatorQuery = {
  cycleId: string | null;
  courseId: string | null;
  classGroupId: string | null;
  teacherId: string | null;
  scope: CoordinatorScope;
};

export function parseCoordinatorQuery(url: URL): CoordinatorQuery {
  const scope = url.searchParams.get("scope");
  return {
    cycleId: url.searchParams.get("cycleId"),
    courseId: url.searchParams.get("courseId"),
    classGroupId: url.searchParams.get("classGroupId"),
    teacherId: url.searchParams.get("teacherId"),
    scope: scope === "internal" || scope === "external" ? scope : "all",
  };
}
