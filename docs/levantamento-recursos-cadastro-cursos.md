# Levantamento de Recursos — CadastroCursos (IGH)

**Sistema:** Plataforma LMS + site institucional + gestão acadêmica  
**Stack:** Next.js 16 (App Router) · TypeScript · Prisma 7 · PostgreSQL · Tailwind CSS 4  
**Data do levantamento:** 03/07/2026

---

## 1. Visão geral

O **CadastroCursos** é uma plataforma web completa para o Instituto Geração Humana (IGH), integrando:

- **Site institucional** público (formações, notícias, transparência, inscrições)
- **LMS** (Learning Management System) para alunos, professores e equipe
- **Gestão acadêmica** (cursos, turmas, matrículas, cronograma, frequência, provas)
- **Comunicação** (e-mail em massa, SMS, notificações in-app)
- **CMS** para edição do site sem código
- **Comunidade, fórum, suporte** e ferramentas de coordenação

**Números aproximados do código:**

| Item | Quantidade |
|------|------------|
| Páginas (UI) | 118 |
| Endpoints API | 264 |
| Models Prisma | 78 |
| Enums Prisma | 35 |
| Perfis de usuário | 5 |

---

## 2. Stack técnica

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 19, Next.js 16 App Router, Tailwind CSS 4 |
| Editor rich text | TipTap 3 (StarterKit, Link, Image, Table) |
| Backend | Route Handlers Next.js (`/api/*`) |
| ORM / DB | Prisma 7 + PostgreSQL (adapter `pg`) |
| Autenticação | Cookie HttpOnly + JWT (HMAC via `jose`) |
| Validação | Zod 4 |
| Senhas | bcryptjs |
| E-mail transacional | Resend |
| Upload de mídia | Apimages, Cloudinary |
| PDF | pdf-lib |
| Planilhas | xlsx |
| Gráficos | Recharts |
| Drag-and-drop | @dnd-kit |
| Testes | Vitest |
| Deploy | Vercel (crons configurados) |

---

## 3. Perfis de usuário (RBAC)

| Perfil | Código | Principais capacidades |
|--------|--------|------------------------|
| **Master** | `MASTER` | Acesso total; backup/restore; logs de acesso; aprovação de alterações no site; gestão de admins |
| **Admin** | `ADMIN` | Gestão acadêmica, CMS, campanhas, fórum, frequência, alunos, turmas, cursos |
| **Coordenador** | `COORDINATOR` | Leitura/escrita staff; reportes de coordenação; exportações |
| **Professor** | `TEACHER` | Turmas lecionadas, frequência, provas, fórum, apresentação de aulas, acompanhamento |
| **Aluno** | `STUDENT` | Minhas turmas, conteúdo, exercícios, provas, fórum, suporte, comunidade |

**Recursos transversais de conta:**

- Login, cadastro, recuperação de senha (e-mail, CPF, responsável)
- Troca de senha obrigatória no primeiro acesso
- Multi-perfil: `/escolher-perfil` quando o usuário tem mais de um papel
- Aceite de termos, privacidade e cookies (versionamento legal)
- Onboarding guiado por perfil
- Notificações in-app (sino)
- Tutoriais interativos (dashboard, aulas, turmas)

---

## 4. Site institucional (público)

**Rotas públicas** — grupo `(institutional)` + `(public)` + `(auth)`:

| Rota | Recurso |
|------|---------|
| `/` | Homepage IGH |
| `/sobre` | Página institucional Sobre |
| `/contato` | Formulário de contato |
| `/formacoes` | Catálogo de formações |
| `/inscreva` | Inscrição pública |
| `/cursos/[slug]` | Detalhe público de curso |
| `/projetos`, `/projetos/[slug]` | Portfólio de projetos |
| `/unidades/[slug]` | Landing por unidade regional |
| `/noticias`, `/noticias/[slug]` | Blog/notícias |
| `/transparencia` | Portal de transparência |
| `/privacidade`, `/termos`, `/politica-de-cookies` | Documentos legais |
| `/tablet/banners` | Exibição fullscreen de banners (tablet) |
| `/login`, `/cadastro`, `/esqueci-senha`, `/redefinir-senha` | Autenticação |
| `/confirmar-inscricao` | Confirmação de matrícula por token |
| `/setup` | Bootstrap do primeiro usuário Master |

**APIs públicas:** inscrições, turmas disponíveis, contato, depoimentos, chat-context.

---

## 5. CMS do site (`/admin/site/*`)

Gestão completa do conteúdo institucional sem alterar código:

| Módulo | Função |
|--------|--------|
| Configurações | Logo, cores, SEO, contatos, QR codes |
| Menu | Navegação hierárquica do site |
| Banners | Carrossel/banners da homepage |
| Sobre / Contato / Inscreva / Formações | Textos das páginas institucionais |
| Formações | Trilhas e vínculo com cursos |
| Notícias | Categorias e posts (rich text + imagens) |
| Projetos | Portfólio |
| Depoimentos | Publicados + fila de moderação |
| Parceiros | Logos e links |
| Unidades | Filiais regionais e cursos oferecidos |
| Transparência | Categorias e documentos |
| FAQ | Perguntas frequentes |
| Legal | Versões de termos/privacidade/cookies (rascunho → publicado) |
| Mensagens de contato | Inbox do formulário |

**Fluxo Master:** alterações sensíveis podem passar por `PendingSiteChange` com aprovação em `/master/acessos` e `/approvacoes`.

---

## 6. Gestão acadêmica (Admin)

### 6.1 Cursos (`/courses`)

- CRUD de cursos (nome, slug, carga horária, status, imagem)
- Conteúdo institucional do curso (rich text opcional)
- Módulos e aulas ordenados
- Por aula: vídeo, PDF, anexos, resumo, imagens, rich text
- Exercícios de múltipla escolha por aula
- Duplicação de curso
- Exportação de planos de aula (PDF)

### 6.2 Turmas (`/class-groups`)

- Vínculo curso + professor(es) — **múltiplos professores por turma**
- Ciclo letivo, capacidade, local, horários, dias da semana
- Status: Planejada, Aberta, Em andamento, Encerrada, Cancelada, Interno, Externo
- **Geração automática de sessões** conforme carga horária do curso, dias da semana e feriados
- Atualização automática de status (cron diário)
- Duplicação de turma
- Regeneração de cronograma apenas quando datas/horários/curso mudam (preserva frequência)

### 6.3 Matrículas (`/enrollments`)

- Matricular aluno em turma
- Status: ACTIVE, SUSPENDED, COMPLETED, CANCELLED
- Confirmação por e-mail com token (`/confirmar-inscricao`)
- E-mail de boas-vindas com senha temporária
- Resumo de frequência por matrícula

### 6.4 Cadastros

| Entidade | Rota | Recursos |
|----------|------|----------|
| Alunos | `/students` | CRUD, anexos (RG, comprovante), export CSV/PDF, audiência para campanhas |
| Professores | `/teachers` | CRUD, soft delete, reativação, vínculo com usuário |
| Usuários | `/users` | Admins e contas do sistema |
| Ciclos | API `/cycles` | Ciclos de matrícula |
| Faixas de horário | `/time-slots` | Horários reutilizáveis |
| Feriados | `/holidays` | Feriados anuais ou data fixa; recálculo de cronograma; notificação a alunos |
| Horários | `/horarios` | Quadro de horários |
| Calendário admin | `/admin/calendario` | Visão calendário |

### 6.5 Frequência (Admin)

- `/admin/frequencia` — visão geral de presença
- Export PDF de frequência

---

## 7. Portal do aluno (`/minhas-turmas`)

### 7.1 Navegação e progresso

| Rota | Recurso |
|------|---------|
| `/minhas-turmas` | Lista de matrículas |
| `/minhas-turmas/[id]` | Dashboard da turma (progresso, próximas aulas, banners) |
| `/minhas-turmas/[id]/conteudo` | Estrutura do curso (módulos/aulas) |
| `/minhas-turmas/calendario` | Calendário pessoal |
| `/minhas-turmas/evolucao` | Evolução e estatísticas |
| `/minhas-turmas/favoritos` | Aulas favoritas |

### 7.2 Player de aula (`/minhas-turmas/[id]/conteudo/aula/[lessonId]`)

**Conteúdo liberado por cronograma** (sessões LIBERADA até a data atual; turmas encerradas liberam curso inteiro).

| Seção | Recurso |
|-------|---------|
| Vídeo | Player com progresso (% assistido) |
| Conteúdo | Rich text paginado por H1; leitura com % lido |
| PDF / anexos | Download e visualização |
| Trechos | Grifos/highlights no conteúdo |
| Material | Anexos complementares |
| Anotações | Bloco de notas com timestamp de vídeo |
| Exercícios | Múltipla escolha (após concluir a aula) |
| Fórum | Publicações com **rich text + até 10 fotos**; galeria com lightbox |

**Progresso:** tempo estudado, última página, conclusão da aula, minutos por sessão.

### 7.3 Provas (`/minhas-turmas/[id]/prova/[examId]`)

- Provas formais por turma
- Cronômetro (modo por início do aluno ou da prova)
- Seleção aleatória ou manual de questões do banco
- Tentativas: em progresso, enviada, expirada, abandonada

### 7.4 Regras de acesso do aluno

- Matrículas visíveis: ACTIVE, SUSPENDED, COMPLETED
- Conteúdo bloqueado se SUSPENDED ou CANCELLED
- **Suspensão por 3 faltas consecutivas** sem justificativa (só na turma suspensa; portal permanece acessível)
- Reativação automática ao registrar presença
- Turmas encerradas: acesso integral ao conteúdo do curso

### 7.5 Fórum do aluno

- Embutido na aula (seção Fórum) e em `/minhas-turmas/forum`
- Visão por curso (todos os alunos matriculados no curso)
- Tópicos, respostas entre alunos, respostas oficiais do professor/admin

### 7.6 Gamificação e engajamento

- Ranking de alunos (`/ranking-alunos`)
- Notificações: aula liberada, mudança de cronograma, documentos pendentes, nível, conquistas, fórum, aniversário
- Campanhas de marketing / pesquisas (modal no dashboard)
- Avaliação da experiência da plataforma (notas 1–10)

### 7.7 Suporte

- `/suporte` — chamados com mensagens e anexos
- Badge de não lidos

---

## 8. Portal do professor (`/professor`)

### 8.1 Turmas

| Rota | Recurso |
|------|---------|
| `/professor/turmas` | Lista com **abas** (Em andamento, Planejadas, Encerradas, Canceladas) — lazy load |
| `/professor/turmas/[id]` | Detalhe: alunos, progresso, exercícios, frequência, dúvidas |
| `/professor/calendario` | Calendário das turmas |
| `/professor/acompanhamento` | Acompanhamento de alunos |
| `/professor/frequencia` | Visão geral de chamada |

### 8.2 Frequência

- Grade estilo planilha: alunos × aulas
- Clique alterna **P** (presente) → **F** (falta) → **J** (justificado)
- Coluna de % de frequência
- API batch `attendance-grid`
- Regras de suspensão automática integradas

### 8.3 Provas

| Rota | Recurso |
|------|---------|
| `/professor/turmas/[id]/provas` | Lista de provas |
| `.../provas/nova` | Criar prova |
| `.../provas/[examId]` | Editar, publicar, encerrar, gabarito |
| Export PDF da prova | |
| Banco de questões reutilizáveis | |
| Replicar prova entre turmas | |
| Revisar tentativas dos alunos | |

### 8.4 Modo apresentação

- `/professor/turmas/[id]/apresentar` — índice de aulas
- `.../apresentar/[lessonId]` — exibição em sala de aula com anexos

### 8.5 Fórum e feedback

- `/professor/forum` — hub por curso/aula
- Resposta oficial a tópicos dos alunos
- `/professor/avaliacoes-experiencia` — feedback recebido
- `/gamificacao` — ranking e pontuação de professores (exercícios, fórum, frequência, etc.)

---

## 9. Comunicação em massa

### 9.1 E-mail (`/admin/email`)

- Templates reutilizáveis
- Campanhas com segmentação (alunos, turma, curso, professores, admins, lista específica)
- Preview, confirmação, processamento em lote
- Webhook Resend (entrega, bounce, clique)
- Fila `EmailOutbox` quando cota diária esgota (cron horário)
- Reenvio individual

### 9.2 SMS (`/admin/sms`)

- Templates e campanhas
- Segmentação similar ao e-mail
- Status por destinatário (enviado, entregue, falha, telefone inválido)
- Processamento via cron

### 9.3 E-mail transacional

- Boas-vindas, confirmação de matrícula, reset de senha
- Suspensão por faltas (com fila outbox)
- Lembretes de documentos pendentes
- Notificações de aniversário (cron diário 11h)

### 9.4 Campanhas de marketing (`/admin/campanhas`)

- Pesquisas e campanhas com período ativo
- Respostas de alunos logados + convidados públicos
- Curtidas (logado e anônimo por cookie)
- Export CSV/PDF

---

## 10. Comunidade IGH (`/comunidade`)

- Tópicos: Ideia, Equipe, Discussão
- Moderação: pendente → aprovado/rejeitado
- Respostas com moderação
- Fila admin em `/admin/comunidade`

---

## 11. Coordenação (`/coordenacao`)

- Reportes de professores/admin à coordenação
- Mensagens, anexos, status (aberto, respondido, fechado)
- Badge de não lidos

---

## 12. Fórum por curso (Admin / Professor / Aluno)

Três portais convergem na mesma base (`EnrollmentLessonQuestion`):

- Tópico com rich text + `imageUrls[]` (até 10 fotos)
- Respostas de alunos (texto)
- Respostas oficiais de professor ou staff (admin/master)
- Notificações de atividade no fórum

---

## 13. Master e infraestrutura

| Recurso | Rota |
|---------|------|
| Logs de acesso (login) | `/master/acessos` |
| Visitas de páginas | API `/master/page-visits` |
| Aprovações de alterações no site | `/approvacoes` |
| Backup do banco | `/backup` |
| Restore | API `/master/restore` |

---

## 14. Automações (Vercel Cron)

| Cron | Horário | Função |
|------|---------|--------|
| `/api/cron/class-groups-status` | 03:00 UTC | Atualiza status automático das turmas |
| `/api/cron/birthday-notifications` | 11:00 UTC | Notificações de aniversário |
| `/api/email/cron/process` | A cada hora | Processa fila de e-mails |

---

## 15. Integrações externas

| Serviço | Uso |
|---------|-----|
| **PostgreSQL** | Banco principal (Vercel Postgres / Neon / local) |
| **Apimages** | Upload de imagens e documentos (alunos, fórum, CMS, cursos) |
| **Cloudinary** | Upload alternativo (assinatura por perfil) |
| **Resend** | E-mail transacional e campanhas |
| **Provedor SMS** | Campanhas SMS (lib em `src/lib/sms`) |
| **Vercel Analytics** | Métricas de uso |

---

## 16. Modelo de dados (resumo)

### Domínios principais (78 models)

**Usuários e sistema:** User, UserPageVisit, UserAccessLog, UserNotification, VerificationToken, AuditLog, LegalDocumentVersion, UserLegalAcceptance, OnboardingGuide, OnboardingUserVisit

**Acadêmico:** Course, CourseModule, CourseLesson, CourseLessonExercise, CourseLessonExerciseOption, ClassGroup, ClassGroupTeacher, ClassSession, SessionAttendance, TimeSlot, Holiday, Cycle, ClassGroupExam (+ Attempt, Question, Answer)

**Aluno:** Student, StudentAttachment, Enrollment, EnrollmentLessonFavorite, EnrollmentLessonNote, EnrollmentLessonPassage, EnrollmentLessonProgress, EnrollmentLessonExerciseAnswer, EnrollmentLessonQuestion, EnrollmentLessonQuestionReply, LessonQuestionTeacherReply

**Professor:** Teacher

**Comunidade e suporte:** IghCommunityTopic, IghCommunityReply, SupportTicket, SupportTicketMessage, CoordinatorReport, CoordinatorReportMessage

**Marketing:** MarketingCampaign, MarketingCampaignResponse, MarketingCampaignGuestResponse (+ likes)

**Comunicação:** SentEmail, EmailOutbox, EmailCampaign, EmailCampaignRecipient, EmailTemplate, SmsCampaign, SmsCampaignRecipient, SmsTemplate

**Site CMS:** SiteSettings, SiteMenuItem, SiteBanner, TabletBanner, SiteFormation, SiteProject, SiteTestimonial, PendingTestimonial, SitePartner, SiteUnit, SiteNewsPost, SiteFaqItem, SiteTransparencyDocument, ContactMessage, PendingSiteChange, etc.

**Feedback:** PlatformExperienceFeedback

---

## 17. APIs por domínio (264 rotas)

| Domínio | ~Rotas | Descrição |
|---------|--------|-----------|
| `/api/auth` | 11 | Login, registro, senha, recuperação, escolha de perfil |
| `/api/me` | 57 | Conta, aluno, matrículas, LMS, fórum, suporte, uploads |
| `/api/teacher` | 34 | Turmas, frequência, provas, fórum, gamificação |
| `/api/admin` | 66 | Usuários, CMS, campanhas, fórum, frequência, onboarding |
| `/api/courses` | 10 | CRUD curso/módulo/aula/exercício |
| `/api/class-groups` | 4 | Turmas e sessões |
| `/api/enrollments` | 4 | Matrículas |
| `/api/students` | 7 | Alunos e exportações |
| `/api/teachers` | 2 | Professores |
| `/api/email` | 14 | Campanhas e templates de e-mail |
| `/api/sms` | 11 | Campanhas e templates SMS |
| `/api/public` | 7 | Inscrição e contato públicos |
| `/api/master` | 7 | Backup, logs, aprovações |
| `/api/coordinator-reports` | 6 | Coordenação |
| Outros | ~30 | Feriados, ciclos, legal, cron, tablet, gamificação |

---

## 18. Componentes e bibliotecas internas relevantes

| Área | Localização |
|------|-------------|
| Autenticação | `src/lib/auth.ts` |
| Suspensão por faltas | `src/lib/enrollment-attendance-suspension.ts` |
| Liberação de aulas | `src/lib/student-lesson-liberation.ts` |
| Status automático turmas | `src/lib/class-group-auto-status.ts` |
| Gamificação professor | `src/lib/teacher-gamification.ts` |
| Ranking alunos | `src/lib/student-gamification-ranking.ts` |
| Rich text | `src/components/ui/RichTextEditor.tsx`, `RichTextViewer.tsx` |
| Fórum | `src/components/forum/*` (composer, galeria, upload) |
| Frequência grade | `src/components/professor/AttendanceGrid.tsx` |
| Dashboard | `src/lib/dashboard-data.ts` |
| E-mail | `src/lib/email/*` |
| Validação | `src/lib/validators/*` |

---

## 19. Testes

- Vitest configurado; testes unitários em `src/lib/sms/__tests__/`
- Cobertura de testes ainda limitada na maior parte do sistema

---

## 20. Observações

1. O **README.md** do repositório descreve o MVP inicial; o sistema evoluiu significativamente além disso.
2. Migrations pendentes no ambiente devem ser aplicadas com `npx prisma migrate deploy`.
3. Variáveis críticas: `DATABASE_URL`, `AUTH_SECRET`, `RESEND_API_KEY`, `APP_URL`, `APIMG_*`, provedor SMS.

---

*Documento gerado automaticamente a partir da análise do código-fonte do projeto CadastroCursos.*
