"use client";

import { Modal } from "@/components/ui/Modal";
import {
  STUDENT_POINTS_PER_LESSON,
  STUDENT_RANKING_GAMIFICATION_POINTS,
  type StudentRankEntry,
} from "@/lib/student-ranking-shared";

export function StudentRankingPointsBreakdownModal({
  entry,
  open,
  onClose,
}: {
  entry: StudentRankEntry | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!entry) return null;
  const b = entry.breakdown;
  const gp = STUDENT_RANKING_GAMIFICATION_POINTS;

  if (!b) {
    return (
      <Modal open={open} onClose={onClose} title={`Pontuação — ${entry.displayName}`} size="small">
        <p className="text-sm text-[var(--text-secondary)]">
          Os detalhes por categoria não estão disponíveis para este registro.
        </p>
      </Modal>
    );
  }
  const forumCount = b.forumQuestions + b.forumReplies;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Pontuação — ${entry.displayName}`}
      size="small"
    >
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Soma dos quatro eixos (mesma regra do painel do aluno e do ranking completo).
      </p>
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--card-border)] text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            <th className="py-2 pr-2">Categoria</th>
            <th className="py-2 pr-2">Cálculo</th>
            <th className="py-2 text-right">Pts</th>
          </tr>
        </thead>
        <tbody className="text-[var(--text-primary)]">
          <tr className="border-b border-[var(--card-border)]/70">
            <td className="py-2.5 pr-2 align-top font-medium">Conteúdo</td>
            <td className="py-2.5 pr-2 align-top text-[var(--text-secondary)]">
              {b.lessonsCompleted} {b.lessonsCompleted === 1 ? "aula" : "aulas"} concluída
              {b.lessonsCompleted === 1 ? "" : "s"} × {STUDENT_POINTS_PER_LESSON}
            </td>
            <td className="py-2.5 text-right tabular-nums font-semibold text-[var(--igh-primary)]">
              {b.pointsContent}
            </td>
          </tr>
          <tr className="border-b border-[var(--card-border)]/70">
            <td className="py-2.5 pr-2 align-top font-medium">Exercícios</td>
            <td className="py-2.5 pr-2 align-top text-[var(--text-secondary)]">
              {b.exerciseAttempts} tentativa{b.exerciseAttempts === 1 ? "" : "s"} + {b.exerciseCorrect}{" "}
              acerto{b.exerciseCorrect === 1 ? "" : "s"} (cada um = 1 pt)
            </td>
            <td className="py-2.5 text-right tabular-nums font-semibold text-[var(--igh-primary)]">
              {b.pointsExercises}
            </td>
          </tr>
          <tr className="border-b border-[var(--card-border)]/70">
            <td className="py-2.5 pr-2 align-top font-medium">Frequência</td>
            <td className="py-2.5 pr-2 align-top text-[var(--text-secondary)]">
              {b.attendancePresent} presença{b.attendancePresent === 1 ? "" : "s"} × {gp.attendancePerPresentStudent}
            </td>
            <td className="py-2.5 text-right tabular-nums font-semibold text-[var(--igh-primary)]">
              {b.pointsFrequency}
            </td>
          </tr>
          <tr className="border-b border-[var(--card-border)]/70">
            <td className="py-2.5 pr-2 align-top font-medium">Fórum</td>
            <td className="py-2.5 pr-2 align-top text-[var(--text-secondary)]">
              {b.forumQuestions} pergunta{b.forumQuestions === 1 ? "" : "s"} + {b.forumReplies}{" "}
              resposta{b.forumReplies === 1 ? "" : "s"} ({forumCount} interações × {gp.forumPerReply})
            </td>
            <td className="py-2.5 text-right tabular-nums font-semibold text-[var(--igh-primary)]">
              {b.pointsForum}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-4 border-t border-[var(--card-border)] pt-3 text-right text-base font-bold tabular-nums text-[var(--igh-primary)]">
        Total: {entry.points} pts
      </p>
    </Modal>
  );
}

/** Texto fixo: regras gerais (sem aluno específico). */
export function StudentRankingPointsHelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const gp = STUDENT_RANKING_GAMIFICATION_POINTS;
  return (
    <Modal open={open} onClose={onClose} title="Como a pontuação do ranking é calculada" size="small">
      <ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed text-[var(--text-secondary)]">
        <li>
          <strong className="text-[var(--text-primary)]">Conteúdo:</strong> cada aula concluída nas matrículas ativas
          soma <strong>{STUDENT_POINTS_PER_LESSON} pontos</strong>.
        </li>
        <li>
          <strong className="text-[var(--text-primary)]">Exercícios:</strong> cada tentativa de resposta e cada acerto
          contam <strong>1 ponto</strong> cada (nas questões ao final das aulas).
        </li>
        <li>
          <strong className="text-[var(--text-primary)]">Frequência:</strong> cada presença registrada (sessões até a
          data atual) soma <strong>{gp.attendancePerPresentStudent} pontos</strong>.
        </li>
        <li>
          <strong className="text-[var(--text-primary)]">Fórum:</strong> cada pergunta ou resposta nas dúvidas das aulas
          soma <strong>{gp.forumPerReply} pontos</strong>.
        </li>
      </ul>
      <p className="mt-4 text-xs text-[var(--text-muted)]">
        O total exibido no ranking é a soma desses quatro valores. Use &quot;Ver detalhes&quot; em cada linha para ver os
        números daquele aluno.
      </p>
    </Modal>
  );
}
