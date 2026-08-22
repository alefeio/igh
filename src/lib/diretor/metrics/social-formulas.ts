import { MIN_AGGREGATE_GROUP_SIZE, shouldSuppressSensitiveGroup } from "@/lib/diretor/lgpd";

export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function classifyNewVsRecurrent(params: {
  servedIds: string[];
  previouslyServedIds: string[];
}): { newIds: string[]; recurrentIds: string[] } {
  const prev = new Set(params.previouslyServedIds);
  const newIds: string[] = [];
  const recurrentIds: string[] = [];
  for (const id of uniqueIds(params.servedIds)) {
    if (prev.has(id)) recurrentIds.push(id);
    else newIds.push(id);
  }
  return { newIds, recurrentIds };
}

/** Meta de pessoas não é comparável a “atendidos únicos” sem definição institucional. */
export function peopleGoalComparable(): false {
  return false;
}

export function computersProgress(done: number, target: number): number | null {
  if (target <= 0) return null;
  return Math.round((done / target) * 1000) / 10;
}

export function lgpdCount(n: number): number | string {
  if (shouldSuppressSensitiveGroup(n, MIN_AGGREGATE_GROUP_SIZE)) return `<${MIN_AGGREGATE_GROUP_SIZE}`;
  return n;
}
