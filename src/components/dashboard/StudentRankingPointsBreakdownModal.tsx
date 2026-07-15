"use client";

import { Modal } from "@/components/ui/Modal";
import {
  STUDENT_POINTS_PER_LESSON,
  STUDENT_RANKING_BONUS_POINTS,
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
  const bonus = STUDENT_RANKING_BONUS_POINTS;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Pontuação — ${entry.displayName}`}
      size="small"
    >
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Soma dos eixos de estudo/engajamento + bônus por ações importantes.
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
              {b.exerciseAttempts} primeira{b.exerciseAttempts === 1 ? "" : "s"} resposta
              {b.exerciseAttempts === 1 ? "" : "s"} + {b.exerciseCorrect} acerto
              {b.exerciseCorrect === 1 ? "" : "s"} (cada um = 1 pt; refações não contam)
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
              {b.forumQuestions} {b.forumQuestions === 1 ? "fórum" : "fóruns"} com 1ª participação ×{" "}
              {gp.forumPerReply} (mensagens extras no mesmo fórum não pontuam)
            </td>
            <td className="py-2.5 text-right tabular-nums font-semibold text-[var(--igh-primary)]">
              {b.pointsForum}
            </td>
          </tr>
          <tr className="border-b border-[var(--card-border)]/70">
            <td className="py-2.5 pr-2 align-top font-medium">Avaliação da experiência</td>
            <td className="py-2.5 pr-2 align-top text-[var(--text-secondary)]">
              {b.hasPlatformExperienceFeedback ? "Enviou avaliação (bônus 1×)" : "Ainda não enviou"}
            </td>
            <td className="py-2.5 text-right tabular-nums font-semibold text-[var(--igh-primary)]">
              {b.pointsPlatformExperience || 0}
            </td>
          </tr>
          <tr className="border-b border-[var(--card-border)]/70">
            <td className="py-2.5 pr-2 align-top font-medium">Homenagem do Dia das Mães</td>
            <td className="py-2.5 pr-2 align-top text-[var(--text-secondary)]">
              {b.hasMothersDayTribute ? "Enviou homenagem (bônus 1×)" : "Ainda não enviou"}
            </td>
            <td className="py-2.5 text-right tabular-nums font-semibold text-[var(--igh-primary)]">
              {b.pointsMothersDay || 0}
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
  const bonus = STUDENT_RANKING_BONUS_POINTS;
  return (
    <Modal open={open} onClose={onClose} title="Como a pontuação do ranking é calculada" size="small">
      <ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed text-[var(--text-secondary)]">
        <li>
          <strong className="text-[var(--text-primary)]">Conteúdo:</strong> cada aula concluída nas matrículas ativas
          soma <strong>{STUDENT_POINTS_PER_LESSON} pontos</strong>.
        </li>
        <li>
          <strong className="text-[var(--text-primary)]">Exercícios:</strong> só a{" "}
          <strong>primeira resposta</strong> de cada exercício conta: 1 ponto pela tentativa e mais 1 se estiver
          correta. Refazer ou alterar a resposta depois não gera pontos.
        </li>
        <li>
          <strong className="text-[var(--text-primary)]">Frequência:</strong> cada presença registrada (sessões até a
          data atual) soma <strong>{gp.attendancePerPresentStudent} pontos</strong>.
        </li>
        <li>
          <strong className="text-[var(--text-primary)]">Fórum:</strong> só a{" "}
          <strong>primeira participação</strong> em cada fórum (aula) soma{" "}
          <strong>{gp.forumPerReply} pontos</strong>. Mensagens extras no mesmo fórum não pontuam.
        </li>
        <li>
          <strong className="text-[var(--text-primary)]">Bônus (ações importantes):</strong> enviar a avaliação da
          experiência soma <strong>{bonus.platformExperienceFeedback} pontos</strong> (conta 1 vez), e enviar a homenagem
          do Dia das Mães soma <strong>{bonus.mothersDayTribute} pontos</strong> (conta 1 vez).
        </li>
      </ul>
      <p className="mt-4 text-xs text-[var(--text-muted)]">
        O total exibido no ranking é a soma desses valores + bônus quando aplicável. Use &quot;Ver detalhes&quot; em cada
        linha para ver os números daquele aluno.
      </p>
    </Modal>
  );
}
