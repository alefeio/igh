import { getAppUrl } from "@/lib/email";
import { formatDateOnly } from "@/lib/format";
import type { EmailAudienceRecipient } from "./audience";
import { validateEmail } from "./email";
import {
  firstName,
  renderSubject,
  renderHtmlContent,
  renderTextContent,
  type PlaceholderData,
} from "./placeholders";

export interface EligibleEmailRecipient {
  recipientType: string;
  recipientId: string;
  recipientNameSnapshot: string;
  emailSnapshot: string;
  emailNormalized: string;
  renderedSubject: string;
  renderedHtmlContent: string | null;
  renderedTextContent: string | null;
}

/**
 * A partir da lista de destinatários da audiência, monta a lista elegível (com e-mail válido, deduplicada)
 * e preenche assunto e conteúdo renderizados para cada um.
 */
export function buildEligibleEmailRecipients(
  recipients: EmailAudienceRecipient[],
  subject: string,
  htmlContent: string | null,
  textContent: string | null
): EligibleEmailRecipient[] {
  const withEmail = recipients.filter(
    (r) => r.email != null && r.email.trim() !== ""
  );
  const validated = withEmail.map((r) => ({
    rec: r,
    result: validateEmail(r.email!),
  }));
  const valid = validated.filter((v) => v.result.valid);
  const byNormalized = new Map<string, (typeof validated)[0]>();
  for (const v of valid) {
    const key = v.result.normalized;
    if (!byNormalized.has(key)) byNormalized.set(key, v);
  }

  const linkAluno = getAppUrl("/login");
  const telefoneIgh = process.env.PUBLIC_CONTACT_PHONE?.trim() ?? "";
  const emailSuporte = process.env.PUBLIC_SUPPORT_EMAIL?.trim() ?? "";

  const list: EligibleEmailRecipient[] = [];
  for (const { rec, result } of byNormalized.values()) {
    const activeEnrollments = Array.isArray(rec.enrollments) ? rec.enrollments : [];
    const uniqueCourseNames = Array.from(
      new Set(activeEnrollments.map((e) => e.courseName).filter((x): x is string => !!x && x.trim() !== ""))
    );
    const cursosMatriculados = uniqueCourseNames.join(", ");
    const turmasMatriculadas = activeEnrollments
      .map((e) => {
        const parts = [
          e.courseName?.trim() || null,
          e.turmaLine?.trim() || null,
        ].filter(Boolean);
        return parts.join(" — ");
      })
      .filter((x) => x.trim() !== "")
      .join("\n");
    const matriculasTexto = activeEnrollments
      .map((e) => {
        const course = e.courseName?.trim() || "Curso";
        const turma = e.turmaLine?.trim() || "";
        const data = e.dataInicio?.trim() || "";
        const horario = e.horario?.trim() || "";
        const local = e.local?.trim() || "";
        const line = [course, turma, data, horario, local].filter((p) => p && p.trim() !== "").join(" · ");
        return line.trim();
      })
      .filter((x) => x !== "")
      .map((x) => `- ${x}`)
      .join("\n");
    const matriculasHtml =
      activeEnrollments.length === 0
        ? ""
        : `<ul>${activeEnrollments
            .map((e) => {
              const course = e.courseName?.trim() || "Curso";
              const turma = e.turmaLine?.trim() || "";
              const data = e.dataInicio?.trim() || "";
              const horario = e.horario?.trim() || "";
              const local = e.local?.trim() || "";
              const line = [course, turma, data, horario, local]
                .filter((p) => p && p.trim() !== "")
                .join(" · ");
              return `<li>${line}</li>`;
            })
            .join("")}</ul>`;

    const data: PlaceholderData = {
      nome: rec.name,
      primeiro_nome: firstName(rec.name),
      turma: rec.turmaLine ?? rec.classGroupName ?? "",
      curso: rec.courseName ?? "",
      cursos_matriculados: cursosMatriculados,
      turmas_matriculadas: turmasMatriculadas,
      matriculas_html: matriculasHtml,
      matriculas_texto: matriculasTexto,
      unidade: "N/A",
      link: linkAluno,
      data_inicio: rec.dataInicio ?? "",
      horario: rec.horario ?? "",
      local: rec.local ?? "",
      link_area_aluno: linkAluno,
      telefone_igh: telefoneIgh,
      email_suporte: emailSuporte,
    };
    list.push({
      recipientType: rec.recipientType,
      recipientId: rec.recipientId,
      recipientNameSnapshot: rec.name,
      emailSnapshot: result.original,
      emailNormalized: result.normalized,
      renderedSubject: renderSubject(subject, data),
      renderedHtmlContent:
        htmlContent != null && htmlContent.trim() !== ""
          ? renderHtmlContent(htmlContent, data)
          : null,
      renderedTextContent:
        textContent != null && textContent.trim() !== ""
          ? renderTextContent(textContent, data)
          : null,
    });
  }
  return list;
}
