import { COORDINATOR_THRESHOLDS } from "@/lib/coordinator/thresholds";

export type DatedMark = { at: string; present: boolean };

export type ObservedChange = {
  available: boolean;
  before: number | null;
  after: number | null;
  delta: number | null;
  note: string;
};

/**
 * Compara a frequência nas aulas lançadas imediatamente antes e depois da intervenção.
 * A janela é curta de propósito, porque as turmas têm poucas aulas.
 */
export function observedAttendanceChange(marks: DatedMark[], interventionAt: string): ObservedChange {
  const window = COORDINATOR_THRESHOLDS.interventionSessionWindow;
  const moment = new Date(interventionAt).getTime();
  const ordered = [...marks].sort((a, b) => a.at.localeCompare(b.at));
  const before = ordered.filter((mark) => new Date(mark.at).getTime() < moment).slice(-window);
  const after = ordered.filter((mark) => new Date(mark.at).getTime() >= moment).slice(0, window);
  const note = "A comparação mostra a evolução temporal observada e não estabelece causalidade.";
  if (before.length === 0 || after.length === 0) {
    return { available: false, before: null, after: null, delta: null, note: "Dados posteriores ainda insuficientes." };
  }
  const percent = (rows: DatedMark[]) => Math.round((rows.filter((row) => row.present).length / rows.length) * 100);
  const beforePercent = percent(before);
  const afterPercent = percent(after);
  return {
    available: true,
    before: beforePercent,
    after: afterPercent,
    delta: afterPercent - beforePercent,
    note,
  };
}
