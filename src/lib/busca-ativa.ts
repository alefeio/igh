import { formatDaysFullPt } from "@/lib/turma-display";

export type MessageAudience = "aluno" | "turma" | "interno";
/** A fila de busca ativa inclui apenas matrículas ativas e efetivadas desta turma. */
export function isBuscaAtivaEligible(enrollment: {
  status: string;
  isPreEnrollment?: boolean;
  studentDeletedAt?: Date | string | null;
}): boolean {
  return (
    enrollment.status === "ACTIVE" && !enrollment.isPreEnrollment && !enrollment.studentDeletedAt
  );
}
export type MessageVariable =
  | "alunoNome"
  | "alunoPrimeiroNome"
  | "cursoNome"
  | "turmaNome"
  | "diasAula"
  | "horarioTurma"
  | "professorNome"
  | "instituicaoNome"
  | "unidadeNome"
  | "localAula"
  | "linkGrupo"
  | "dataAula"
  | "temaAula"
  | "dataAusencia"
  | "dataBuscaAtiva"
  | "dataRegistro"
  | "prazoResposta"
  | "novaData"
  | "novoHorario"
  | "motivo"
  | "conteudo"
  | "atividade"
  | "proximoAssunto"
  | "linkMaterial"
  | "diasReforco"
  | "horarioReforco"
  | "retornoAluno"
  | "resultadoContato";
export type MessageTemplate = {
  id: string;
  version: number;
  title: string;
  description: string;
  category: string;
  audience: MessageAudience;
  body: string;
  required?: MessageVariable[];
  evidence?: "zero-presence" | "recurring-absence";
};
const T = (
  id: string,
  title: string,
  category: string,
  audience: MessageAudience,
  body: string,
  required: MessageVariable[] = [],
  description = "",
  evidence?: MessageTemplate["evidence"],
): MessageTemplate => ({
  id,
  version: 1,
  title,
  category,
  audience,
  body,
  required,
  description,
  evidence,
});

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  T(
    "ausencia-direta",
    "Ausência — mensagem direta",
    "Busca ativa",
    "aluno",
    "Olá, {{alunoPrimeiroNome}}! Tudo bem? 😊\n\nAqui é {{professorNome}}, do curso de *{{cursoNome}}* do *{{instituicaoNome}}*.\n\nSenti sua falta na aula de {{dataAusencia}} e gostaria de saber se está tudo bem e se houve alguma dificuldade para participar.\n\nSua turma é *{{turmaNome}}*, com aulas {{diasAula}}, das *{{horarioTurma}}*.\n\nVocê pretende continuar no curso? Se precisar de ajuda para acompanhar os conteúdos, pode me avisar. 🤝",
    ["dataAusencia"],
  ),
  T(
    "ausencia-acolhedora",
    "Ausência — acolhedora",
    "Busca ativa",
    "aluno",
    "Olá, {{alunoPrimeiroNome}}! Tudo bem? 😊\n\nAqui é {{professorNome}}, do curso de *{{cursoNome}}* do *{{instituicaoNome}}*.\n\nPercebi sua ausência e estou entrando em contato para saber como você está e se algum imprevisto dificultou sua participação.\n\nEstou à disposição para orientar você sobre os conteúdos.\n\n📚 *Turma:* {{turmaNome}}\n📅 *Dias:* {{diasAula}}\n🕒 *Horário:* {{horarioTurma}}\n\nVocê pretende continuar participando? Existe alguma dificuldade com a qual possamos ajudar? 🤝",
  ),
  T(
    "primeira-presenca",
    "Ainda não participou",
    "Busca ativa",
    "aluno",
    "Olá, {{alunoPrimeiroNome}}! Tudo bem?\n\nAqui é {{professorNome}}, do curso de *{{cursoNome}}* do *{{instituicaoNome}}*.\n\nAté o momento, os registros de frequência disponíveis não indicam sua participação nas aulas da turma *{{turmaNome}}*, que acontecem {{diasAula}}, das *{{horarioTurma}}*.\n\nVocê ainda tem interesse e disponibilidade? Se encontrou alguma dificuldade para iniciar, pode me contar para verificarmos como ajudar.",
    [],
    "Requer aulas contabilizadas após a matrícula.",
    "zero-presence",
  ),
  T(
    "faltas-recorrentes",
    "Faltas recorrentes",
    "Busca ativa",
    "aluno",
    "Olá, {{alunoPrimeiroNome}}! Tudo bem?\n\nAqui é {{professorNome}}, do curso de *{{cursoNome}}* do *{{instituicaoNome}}*.\n\nPercebemos ausências em mais de uma aula e gostaríamos de saber se existe alguma dificuldade para acompanhar o curso.\n\nSua turma é *{{turmaNome}}*, com aulas {{diasAula}}, das *{{horarioTurma}}*.\n\nVocê pretende continuar? Podemos conversar sobre orientações para retomar os conteúdos.",
    [],
    "Confira as faltas antes de usar.",
    "recurring-absence",
  ),
  T(
    "sem-retorno",
    "Nova tentativa sem retorno",
    "Busca ativa",
    "aluno",
    "Olá, {{alunoPrimeiroNome}}! Tudo bem?\n\nEstou retomando o contato realizado em *{{dataBuscaAtiva}}* sobre sua participação no curso de *{{cursoNome}}* do *{{instituicaoNome}}*.\n\nVocê pretende continuar na turma *{{turmaNome}}*, com aulas {{diasAula}}, das *{{horarioTurma}}*? Quando puder, responda informando seu interesse ou alguma dificuldade para participar.",
    ["dataBuscaAtiva"],
  ),
  T(
    "saiu-grupo",
    "Saiu do grupo — conferir",
    "Busca ativa",
    "aluno",
    "Olá, {{alunoPrimeiroNome}}! Tudo bem?\n\nAqui é {{professorNome}}, do curso de *{{cursoNome}}* do *{{instituicaoNome}}*.\n\nVerificamos que você não está no grupo de WhatsApp da turma *{{turmaNome}}*. Você ainda pretende participar das aulas, que acontecem {{diasAula}}, das *{{horarioTurma}}*?\n\nSe a saída aconteceu por engano ou se precisar de ajuda para retornar, pode me avisar.",
  ),
  T(
    "retomada",
    "Retomada confirmada",
    "Retorno",
    "aluno",
    "Olá, {{alunoPrimeiroNome}}! Obrigado pelo retorno. 😊\n\nConforme conversamos, você pretende continuar no curso de *{{cursoNome}}*, na turma *{{turmaNome}}*.\n\n📅 *Dias:* {{diasAula}}\n🕒 *Horário:* {{horarioTurma}}\n\nVamos orientar você sobre os conteúdos trabalhados. Se surgir alguma dificuldade, entre em contato.",
    [],
    "Use apenas após confirmação do aluno.",
  ),
  T(
    "convite-grupo",
    "Convite ao grupo",
    "Convite",
    "aluno",
    "Olá, {{alunoPrimeiroNome}}! Aqui é {{professorNome}}, do curso de *{{cursoNome}}* do *{{instituicaoNome}}*.\n\nEste é o link do grupo da sua turma *{{turmaNome}}*, com aulas {{diasAula}}, das *{{horarioTurma}}*:\n{{linkGrupo}}\n\nNo grupo, compartilhamos avisos e orientações sobre o curso. Se tiver dificuldade para entrar, pode me avisar.",
  ),
  T(
    "lista-espera",
    "Convite à lista de espera",
    "Convite",
    "aluno",
    "Olá, {{alunoPrimeiroNome}}! Tudo bem? 😊\n\nAqui é {{professorNome}}, do curso de *{{cursoNome}}* do *{{instituicaoNome}}*.\n\nEstamos consultando o interesse na turma *{{turmaNome}}*, com aulas {{diasAula}}, das *{{horarioTurma}}*. Você tem disponibilidade nesse horário? Responda para orientarmos os próximos passos conforme a disponibilidade e a organização das matrículas.",
    [],
    "A cópia não ocupa vaga nem efetiva matrícula.",
  ),
  T(
    "confirmacao-individual",
    "Confirmar participação",
    "Confirmação",
    "aluno",
    "Olá, {{alunoPrimeiroNome}}! Aqui é {{professorNome}}, do *{{instituicaoNome}}*. Você confirma sua participação no curso de *{{cursoNome}}*, turma *{{turmaNome}}*, {{diasAula}}, das *{{horarioTurma}}*? Caso tenha alguma dúvida, pode me contar.",
  ),
  T(
    "email-individual",
    "Conferir e-mail de confirmação",
    "Confirmação",
    "aluno",
    "Olá, {{alunoPrimeiroNome}}! Confira se recebeu o e-mail de confirmação do curso de *{{cursoNome}}*. Se não encontrar, verifique também a pasta de spam e entre em contato para conferirmos o cadastro.",
  ),
  T(
    "tentativa",
    "Tentativa de contato realizada",
    "Registro interno",
    "interno",
    "Em {{dataBuscaAtiva}}, foi realizada tentativa de contato com {{alunoNome}}, da turma {{turmaNome}} do curso de {{cursoNome}}, para verificar sua participação.\nResultado informado: {{resultadoContato}}.\nResponsável: {{professorNome}}.\nData do registro: {{dataRegistro}}.",
    ["dataBuscaAtiva", "resultadoContato"],
  ),
  T(
    "interno-sem-retorno",
    "Sem retorno até o registro",
    "Registro interno",
    "interno",
    "Foi realizada tentativa de busca ativa em {{dataBuscaAtiva}} com {{alunoNome}}, da turma {{turmaNome}} do curso de {{cursoNome}}. Até {{dataRegistro}}, não foi informado retorno. A situação permanece em acompanhamento, sem confirmação de desistência.\nResponsável: {{professorNome}}.",
    ["dataBuscaAtiva"],
  ),
  T(
    "interno-sem-presenca",
    "Sem presença — acompanhamento",
    "Registro interno",
    "interno",
    "Até {{dataRegistro}}, os registros de frequência disponíveis não indicam participação de {{alunoNome}} nas aulas aplicáveis à sua matrícula na turma {{turmaNome}} do curso de {{cursoNome}}.\nBusca ativa pendente de confirmação.\nResponsável: {{professorNome}}.",
    [],
    "Requer aulas contabilizadas após a matrícula.",
    "zero-presence",
  ),
  T(
    "desistencia",
    "Desistência informada",
    "Registro interno",
    "interno",
    "Em {{dataBuscaAtiva}}, {{alunoNome}}, da turma {{turmaNome}} do curso de {{cursoNome}}, informou que não poderá continuar participando.\nRelato informado: {{retornoAluno}}.\nSolicita-se encaminhamento conforme o procedimento institucional.\nResponsável: {{professorNome}}. Data do registro: {{dataRegistro}}.",
    ["dataBuscaAtiva", "retornoAluno"],
    "Não cancela a matrícula.",
  ),
  T(
    "interno-saiu-grupo",
    "Saída do grupo — conferir",
    "Registro interno",
    "interno",
    "Em {{dataRegistro}}, foi registrada a informação de que {{alunoNome}}, da turma {{turmaNome}} do curso de {{cursoNome}}, não está no grupo. Essa informação isolada não confirma desistência. Conferir interesse e eventual resposta.\nResponsável: {{professorNome}}.",
  ),
  T(
    "contato-indisponivel",
    "Contato indisponível / cadastro",
    "Registro interno",
    "interno",
    "Em {{dataRegistro}}, foi identificada dificuldade para contato com {{alunoNome}}, da turma {{turmaNome}} do curso de {{cursoNome}}.\nDescrição: {{motivo}}.\nConferir os dados e meios autorizados, sem concluir desistência.\nResponsável: {{professorNome}}.",
    ["motivo"],
  ),
  T(
    "encaminhamento",
    "Encaminhamento para análise",
    "Registro interno",
    "interno",
    "Em {{dataRegistro}}, foi solicitado acompanhamento da situação de {{alunoNome}}, da turma {{turmaNome}} do curso de {{cursoNome}}.\nFatos verificados: {{motivo}}.\nA situação foi encaminhada para análise conforme o procedimento institucional. Este registro não efetiva cancelamento.\nResponsável: {{professorNome}}.",
    ["motivo"],
  ),
  T(
    "boas-vindas",
    "Boas-vindas ao grupo",
    "Avisos da turma",
    "turma",
    "Olá, turma! Sejam bem-vindos ao curso de *{{cursoNome}}* do *{{instituicaoNome}}*! 😊\n\nNossa turma é *{{turmaNome}}*, com aulas {{diasAula}}, das *{{horarioTurma}}*. Compartilharemos por aqui avisos e orientações. Estamos à disposição para ajudar!",
  ),
  T(
    "dias-horarios",
    "Dias, horários e local",
    "Avisos da turma",
    "turma",
    "📚 *{{cursoNome}}* — {{turmaNome}}\n📅 Aulas: {{diasAula}}\n🕒 Horário: {{horarioTurma}}\n\nEm caso de dúvida sobre sua participação, fale conosco em particular.",
  ),
  T(
    "confirmacao-turma",
    "Confirmação de participação",
    "Avisos da turma",
    "turma",
    "Olá, turma! Por favor, confirmem individualmente se poderão participar das aulas de *{{cursoNome}}* da turma *{{turmaNome}}*, {{diasAula}}, das *{{horarioTurma}}*. Para informações pessoais, escrevam no privado.",
  ),
  T(
    "email-turma",
    "Conferir e-mail",
    "Avisos da turma",
    "turma",
    "Olá, turma! Confiram o e-mail de confirmação do curso de *{{cursoNome}}*, inclusive a pasta de spam. Se não receberam, falem conosco no privado para conferirmos o cadastro.",
  ),
  T(
    "divulgacao",
    "Divulgação do curso",
    "Avisos da turma",
    "turma",
    "Conheça o curso de *{{cursoNome}}* do *{{instituicaoNome}}*. Nossa turma tem encontros {{diasAula}}, das *{{horarioTurma}}*. Para saber sobre inscrições e disponibilidade atual, consulte os canais oficiais.",
  ),
  T(
    "lembrete-aula",
    "Lembrete de aula",
    "Avisos da turma",
    "turma",
    "📢 *LEMBRETE — {{cursoNome}}*\n\nOlá, turma! Nossa aula está prevista para *{{dataAula}}*.\n👥 *Turma:* {{turmaNome}}\n🕒 *Horário:* {{horarioTurma}}\n\nConto com a participação de vocês! Em caso de dificuldade, entrem em contato pelo privado.\n\n{{professorNome}} — {{instituicaoNome}}",
    ["dataAula"],
    "Preencha uma data confirmada pelo calendário.",
  ),
  T(
    "faltas-turma",
    "Comunicar faltas",
    "Avisos da turma",
    "turma",
    "Olá, turma! Se não puderem comparecer a uma aula de *{{cursoNome}}*, avisem a equipe pelo privado para que possamos orientar o acompanhamento. Não publiquem justificativas pessoais no grupo.",
  ),
  T(
    "nova-confirmacao",
    "Nova solicitação de confirmação",
    "Avisos da turma",
    "turma",
    "Olá, turma! Precisamos confirmar o interesse em continuar nas aulas de *{{cursoNome}}*, turma *{{turmaNome}}*. Por favor, respondam individualmente à equipe. Obrigado!",
  ),
  T(
    "material",
    "Material de apoio",
    "Avisos da turma",
    "turma",
    "Olá, turma! Compartilhamos o seguinte material de apoio para *{{cursoNome}}*: {{linkMaterial}}\n\nSe tiverem dificuldade de acesso, avisem no privado.",
    ["linkMaterial"],
  ),
  T(
    "atividade",
    "Atividade prática",
    "Avisos da turma",
    "turma",
    "Olá, turma! Na próxima atividade de *{{cursoNome}}*, vamos praticar: {{atividade}}. Tragam suas dúvidas para conversarmos durante a aula.",
    ["atividade"],
  ),
  T(
    "laboratorio",
    "Combinados do laboratório",
    "Avisos da turma",
    "turma",
    "Olá, turma! Para cuidarmos do laboratório durante as aulas de *{{cursoNome}}*, usem os equipamentos com atenção, sigam as orientações do professor e avisem se encontrarem alguma dificuldade. Obrigado!",
  ),
  T(
    "incentivo",
    "Incentivo e acolhimento",
    "Avisos da turma",
    "turma",
    "Olá, turma! Aprender exige tempo e prática. Durante o curso de *{{cursoNome}}*, perguntem sempre que precisarem e respeitem o ritmo de cada colega. Estamos juntos nessa jornada! 😊",
  ),
  T(
    "cancelamento-aula",
    "Aula cancelada — nova data pendente",
    "Avisos da turma",
    "turma",
    "📢 *AVISO — {{cursoNome}}*\n\nA aula prevista para *{{dataAula}}* foi cancelada. A nova data será informada após confirmação.\n\nObrigado pela compreensão!\n{{professorNome}} — {{instituicaoNome}}",
    ["dataAula"],
  ),
  T(
    "remarcacao",
    "Remarcação confirmada",
    "Avisos da turma",
    "turma",
    "📢 *AVISO — {{cursoNome}}*\n\nA aula de *{{dataAula}}* foi remarcada.\n📅 *Nova data:* {{novaData}}\n🕒 *Horário:* {{novoHorario}}\n\nObrigado pela compreensão!\n{{professorNome}} — {{instituicaoNome}}",
    ["dataAula", "novaData", "novoHorario"],
    "Use somente após confirmação.",
  ),
  T(
    "frequencia",
    "Lembrete sobre frequência",
    "Avisos da turma",
    "turma",
    "Olá, turma! A participação nas aulas de *{{cursoNome}}* ajuda no aprendizado e no acompanhamento do curso. Se estiverem com dificuldade para comparecer, entrem em contato em particular.",
  ),
  T(
    "encerramento-aula",
    "Encerramento da aula",
    "Avisos da turma",
    "turma",
    "Olá, turma! Hoje trabalhamos {{conteudo}} e praticamos {{atividade}}. No próximo encontro, planejamos estudar {{proximoAssunto}}. Obrigado pela participação!",
    ["conteudo", "atividade", "proximoAssunto"],
  ),
  T(
    "feedback",
    "Pedido de feedback",
    "Avisos da turma",
    "turma",
    "Olá, turma! Como tem sido sua experiência no curso de *{{cursoNome}}*? Sua opinião nos ajuda a melhorar. Se preferirem, enviem sugestões em particular. Obrigado!",
  ),
  T(
    "encerramento-curso",
    "Encerramento do curso",
    "Avisos da turma",
    "turma",
    "Olá, turma! Encerramos os encontros de *{{cursoNome}}*. Obrigado pela participação e dedicação. A equipe informará os próximos passos pelos canais oficiais. 🎉",
    [],
    "Use somente quando o curso estiver encerrado.",
  ),
  T(
    "proposta-reforco",
    "Proposta de reforço",
    "Reforço",
    "turma",
    "Olá, pessoal! 😊\n\nEstamos avaliando uma aula de reforço de *{{cursoNome}}*, {{diasReforco}}, das *{{horarioReforco}}*, para revisar conteúdos e praticar com mais calma.\n\nA proposta depende de confirmação da organização do curso. Por favor, informem se têm interesse e disponibilidade nesse horário.\n\n{{professorNome}} — {{instituicaoNome}}",
    ["diasReforco", "horarioReforco"],
  ),
  T(
    "enquete-reforco",
    "Pergunta de reforço — duas opções",
    "Reforço",
    "turma",
    "Você tem interesse e disponibilidade para participar da proposta de reforço de *{{cursoNome}}*, {{diasReforco}}, das *{{horarioReforco}}*?\n\n1. Sim, tenho disponibilidade\n2. Não tenho disponibilidade\n\nA aula ainda depende de confirmação.",
    ["diasReforco", "horarioReforco"],
    "Texto copiável; crie a enquete manualmente no WhatsApp.",
  ),
  T(
    "proposta-reforco-curta",
    "Proposta de reforço — curta",
    "Reforço",
    "turma",
    "Olá, pessoal! 😊\n\nEstamos avaliando uma aula extra de reforço de *{{cursoNome}}*, {{diasReforco}}, das *{{horarioReforco}}*. A ideia é praticar com mais calma e tirar dúvidas.\n\nA proposta depende de confirmação. Vocês têm interesse e disponibilidade?",
    ["diasReforco", "horarioReforco"],
  ),
  T(
    "enquete-reforco-quatro",
    "Pergunta de reforço — quatro opções",
    "Reforço",
    "turma",
    "Você apoia a proposta de reforço de *{{cursoNome}}*, {{diasReforco}}, das *{{horarioReforco}}*?\n\n1. Sim, apoio e posso participar\n2. Apoio, mas não posso nesse horário\n3. Talvez, depende da semana\n4. Não tenho interesse\n\nA aula ainda depende de confirmação.",
    ["diasReforco", "horarioReforco"],
    "Versão anterior da coletânea; crie a enquete manualmente no WhatsApp.",
  ),
  T(
    "material-sem-link",
    "Material de apoio — sem link",
    "Avisos da turma",
    "turma",
    "📚 *MATERIAL DE APOIO — {{cursoNome}}*\n\nOlá, turma! O material da aula sobre *{{temaAula}}* está disponível pelos canais combinados. Revisem os exemplos e pratiquem os passos com calma. Se surgir alguma dúvida, anotem para conversarmos na próxima aula. 💻",
    ["temaAula"],
  ),
  T(
    "lembrete-aula-tema",
    "Lembrete de aula — com tema",
    "Avisos da turma",
    "turma",
    "📢 *LEMBRETE — {{cursoNome}}*\n\nOlá, turma! Nossa aula está prevista para *{{dataAula}}*.\n👥 *Turma:* {{turmaNome}}\n🕒 *Horário:* {{horarioTurma}}\n📚 *Tema:* {{temaAula}}\n\nConto com a participação de vocês! Em caso de dificuldade, entrem em contato pelo privado.\n\n{{professorNome}} — {{instituicaoNome}}",
    ["dataAula", "temaAula"],
  ),
];

export type MessageContext = {
  classGroupId: string;
  courseId: string;
  courseName: string;
  turmaNome: string;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  location: string | null;
  unidadeNome: string | null;
  whatsappGroupUrl: string | null;
  professorNome: string;
  revision: string;
  enrollmentId?: string;
  waitlistId?: string;
  studentId?: string;
  studentName?: string;
  studentPhone?: string | null;
  status?: string;
  /** Calculado pela API; não é um campo persistido. */
  contactEligible?: boolean;
  isPreEnrollment?: boolean;
  studentUnavailable?: boolean;
  hasBuscaAtiva?: boolean;
  attendancePresentCount?: number;
  attendanceRecordedCount?: number;
  attendanceTotalSessions?: number;
  attendanceUnjustifiedAbsenceCount?: number;
  history?: {
    id: string;
    kind: string;
    body: string;
    createdAt: string;
    authorName: string;
    contactType: string | null;
    result: string | null;
    factDate: string | null;
  }[];
};
export function filterBuscaAtivaStudents(
  items: MessageContext[],
  search: string,
  frequency: "" | "sem-presenca" | "faltas",
): MessageContext[] {
  const name = search.trim().toLocaleLowerCase("pt-BR");
  return items.filter((item) => {
    if (name && !item.studentName?.toLocaleLowerCase("pt-BR").includes(name)) return false;
    if (
      frequency === "sem-presenca" &&
      !(
        item.attendanceTotalSessions &&
        item.attendanceRecordedCount === item.attendanceTotalSessions &&
        item.attendancePresentCount === 0
      )
    )
      return false;
    if (frequency === "faltas" && !((item.attendanceUnjustifiedAbsenceCount ?? 0) > 0))
      return false;
    return true;
  });
}
export const VARIABLE_LABELS: Record<MessageVariable, string> = {
  alunoNome: "Nome do aluno",
  alunoPrimeiroNome: "Primeiro nome",
  cursoNome: "Curso",
  turmaNome: "Turma",
  diasAula: "Dias das aulas",
  horarioTurma: "Horário da turma",
  professorNome: "Professor",
  instituicaoNome: "Instituição",
  unidadeNome: "Unidade",
  localAula: "Local",
  linkGrupo: "Link do grupo",
  dataAula: "Data da aula",
  temaAula: "Tema",
  dataAusencia: "Data da ausência",
  dataBuscaAtiva: "Data do contato anterior",
  dataRegistro: "Data do registro",
  prazoResposta: "Prazo",
  novaData: "Nova data",
  novoHorario: "Novo horário",
  motivo: "Motivo / fatos",
  conteudo: "Conteúdo",
  atividade: "Atividade",
  proximoAssunto: "Próximo assunto",
  linkMaterial: "Link do material",
  diasReforco: "Dias do reforço",
  horarioReforco: "Horário do reforço",
  retornoAluno: "Relato do aluno",
  resultadoContato: "Resultado do contato",
};
export const DATE_VARIABLES = new Set<MessageVariable>([
  "dataAula",
  "dataAusencia",
  "dataBuscaAtiva",
  "dataRegistro",
  "prazoResposta",
  "novaData",
]);
export function todayBelem(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Belem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function formatCalendarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(+y, +m - 1, +d));
  return date.getUTCFullYear() === +y && date.getUTCMonth() === +m - 1 && date.getUTCDate() === +d
    ? `${d}/${m}/${y}`
    : "";
}
export function contextVariables(
  context: MessageContext,
): Partial<Record<MessageVariable, string>> {
  const name = context.studentName?.trim() ?? "";
  return {
    alunoNome: name,
    alunoPrimeiroNome: name.split(/\s+/)[0] ?? "",
    cursoNome: context.courseName,
    turmaNome: context.turmaNome,
    diasAula: formatDaysFullPt(context.daysOfWeek),
    horarioTurma:
      context.startTime && context.endTime ? `${context.startTime} às ${context.endTime}` : "",
    professorNome: context.professorNome,
    instituicaoNome: "Instituto Gustavo Hessel",
    unidadeNome: context.unidadeNome ?? "",
    localAula: context.location ?? "",
    linkGrupo: context.whatsappGroupUrl ?? "",
    dataRegistro: formatCalendarDate(todayBelem()),
  };
}
export function templateVariables(template: MessageTemplate): MessageVariable[] {
  return [
    ...new Set([...template.body.matchAll(/{{\s*([^{}]+)\s*}}/g)].map((m) => m[1].trim())),
  ].filter((name): name is MessageVariable => Object.hasOwn(VARIABLE_LABELS, name));
}
export function renderMessage(
  template: MessageTemplate,
  values: Partial<Record<MessageVariable, string>>,
): { text: string; missing: MessageVariable[]; unknown: string[] } {
  const names = [
    ...new Set([...template.body.matchAll(/{{\s*([^{}]+)\s*}}/g)].map((m) => m[1].trim())),
  ];
  const unknown = names.filter((name) => !Object.hasOwn(VARIABLE_LABELS, name));
  const missing = names.filter(
    (name): name is MessageVariable =>
      Object.hasOwn(VARIABLE_LABELS, name) && !values[name as MessageVariable]?.trim(),
  );
  const text = template.body.replace(/{{\s*([^{}]+)\s*}}/g, (_, name: string) => {
    const key = name.trim() as MessageVariable;
    const value = values[key]?.trim();
    return value
      ? DATE_VARIABLES.has(key)
        ? formatCalendarDate(value) || value
        : value
      : `{{${name}}}`;
  });
  return { text, missing, unknown };
}
export function messageEvidenceWarning(
  template: MessageTemplate,
  context: MessageContext,
): string | null {
  if (
    template.evidence === "zero-presence" &&
    !(
      context.attendanceTotalSessions &&
      context.attendanceTotalSessions > 0 &&
      context.attendanceRecordedCount === context.attendanceTotalSessions &&
      context.attendancePresentCount === 0
    )
  )
    return "A frequência disponível não comprova ausência em aulas aplicáveis à matrícula. Confira antes de usar este texto.";
  if (
    template.evidence === "recurring-absence" &&
    (context.attendanceUnjustifiedAbsenceCount ?? 0) < 2
  )
    return "Não há duas faltas sem justificativa registradas. Confira os fatos antes de usar este texto.";
  return null;
}

export const CONTACT_TYPES = [
  "OBSERVACAO",
  "CONTATO_REALIZADO",
  "RETORNO_INFORMADO",
  "ENCAMINHAMENTO",
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];
export const CONTACT_RESULTS = [
  "AGUARDANDO_RESPOSTA",
  "INTERESSE_CONFIRMADO",
  "DIFICULDADE_RELATADA",
  "DESISTENCIA_INFORMADA",
  "CONTATO_INDISPONIVEL",
] as const;
export type ContactResult = (typeof CONTACT_RESULTS)[number];
export const RESULT_LABELS: Record<ContactResult, string> = {
  AGUARDANDO_RESPOSTA: "Aguardando resposta",
  INTERESSE_CONFIRMADO: "Interesse em continuar confirmado",
  DIFICULDADE_RELATADA: "Dificuldade relatada",
  DESISTENCIA_INFORMADA: "Desistência informada",
  CONTATO_INDISPONIVEL: "Contato indisponível",
};
const STRUCTURED_RECORD_HEADER = "Registro estruturado de busca ativa (v1)";
const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  OBSERVACAO: "Rascunho / observação",
  CONTATO_REALIZADO: "Contato realizado (informado pelo professor)",
  RETORNO_INFORMADO: "Retorno informado pelo professor",
  ENCAMINHAMENTO: "Encaminhamento",
};

export function buildAdministrativeRecord(input: {
  type: ContactType;
  text: string;
  factDate?: string;
  channel?: string;
  result?: ContactResult;
  note?: string;
  authorName: string;
  templateId?: string;
  templateVersion?: number;
}): string {
  const lines = [
    STRUCTURED_RECORD_HEADER,
    `Natureza: ${CONTACT_TYPE_LABELS[input.type]}`,
    input.templateId && input.templateVersion
      ? `Modelo: ${input.templateId} (v${input.templateVersion})`
      : "",
    input.factDate ? `Data do fato: ${formatCalendarDate(input.factDate)}` : "",
    input.channel ? `Canal: ${input.channel}` : "",
    input.result ? `Resultado informado: ${RESULT_LABELS[input.result]}` : "",
    `Responsável: ${input.authorName}`,
    input.note?.trim() ? `Observação: ${input.note.trim()}` : "",
  ];
  return `${lines.filter(Boolean).join("\n")}\n\n${input.text.trim()}`;
}

/** Só registros com o marcador v1 são classificados; textos livres antigos permanecem livres. */
export function parseAdministrativeRecord(body: string): {
  contactType: ContactType;
  result: ContactResult | null;
  factDate: string | null;
} | null {
  const header = body.split("\n\n", 1)[0]?.split("\n") ?? [];
  if (header[0] !== STRUCTURED_RECORD_HEADER) return null;
  const contactType = CONTACT_TYPES.find(
    (type) => header[1] === `Natureza: ${CONTACT_TYPE_LABELS[type]}`,
  );
  if (!contactType) return null;
  const resultLabel = header.find((line) => line.startsWith("Resultado informado: "))?.slice(21);
  const result = resultLabel
    ? (CONTACT_RESULTS.find((item) => RESULT_LABELS[item] === resultLabel) ?? null)
    : null;
  const dateLabel = header.find((line) => line.startsWith("Data do fato: "))?.slice(14);
  let factDate: string | null = null;
  if (dateLabel) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateLabel);
    if (match) {
      const iso = `${match[3]}-${match[2]}-${match[1]}`;
      if (formatCalendarDate(iso) === dateLabel) factDate = iso;
    }
  }
  return { contactType, result, factDate };
}
export function whatsappDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const raw = phone.trim();
  const digits = raw.replace(/\D/g, "");
  if (!/^\+?[\d\s().-]+$/.test(raw) || digits.length < 10 || digits.length > 15) return null;
  return raw.startsWith("+")
    ? digits
    : digits.length === 10 || digits.length === 11
      ? `55${digits}`
      : digits;
}
export function whatsappMessageUrl(
  phone: string | null | undefined,
  message: string,
): string | null {
  const digits = whatsappDigits(phone);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}
