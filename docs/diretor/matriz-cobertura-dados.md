# Matriz de cobertura de dados — perfil Diretor

**Status:** atualizada com decisões aprovadas (21/08/2026)  
**Legenda:** `EXISTENTE` · `DERIVÁVEL` · `PARCIAL` · `NOVO_MODELO` · `NOVA_COLETA` · `NÃO_RECOMENDADO`

### Correções obrigatórias nesta revisão

| Tema | Antes (plano) | Decisão aprovada |
|------|---------------|------------------|
| KPI “evasão” streak 4 | Chamado evasão | **Risco crítico por faltas** / cancelamentos por faltas (comprovado) — nunca “evasão confirmada” |
| Frequência denom. | Sessões da turma | **Oportunidades aluno × sessão** elegíveis |
| Sessões | Critérios mistos | Função canônica `LIBERADA` + ≤ `dataAsOf` + qualidade p/ passadas não liberadas |
| Conclusão | Denominador ambíguo | Principal: iniciantes COMPLETED ÷ iniciantes; só coortes encerradas |
| Beneficiário | Por matrícula/confirmação | Atendido = ≥1 presença elegível; separar confirmados, concluintes, doações |
| Meta people &lt;80% 2º sem. | Alerta proposto | **Removido** — só realizado × meta anual |
| Ocupação inicial | Candidata à Visão Geral | Estimativa; **fora** da Visão Geral na Fase 1 |
| Alertas persistentes | Opcional Fase 1 | Só derivados na Fase 1 |
| LGPD | n&lt;5 sugerido | `MIN_AGGREGATE_GROUP_SIZE = 5` configurável |

---

## Como ler esta matriz

- **EXISTENTE:** campo/relação existe e o cálculo já é (ou pode ser) feito com confiança.
- **DERIVÁVEL:** models existem; falta agregação/API/página (sem migration).
- **PARCIAL:** parte dos dados existe; denominador, histórico ou vínculo incompleto.
- **NOVO_MODELO:** exige estrutura nova no Prisma.
- **NOVA_COLETA:** depende de processo humano/externo além do software atual.
- **NÃO_RECOMENDADO:** não criar com a base atual (risco de interpretação falsa).

Fontes principais auditadas: `prisma/schema.prisma`, `src/lib/director-dashboard-data.ts`, `enrollment-attendance-*.ts`, `financeiro.ts`, models de Gerência.

---

## Visão Geral / Prioridades

| Indicador | Situação | Página | Origem / models | Campos-chave | Histórico | Qualidade | Lacuna | Ação | Atualização |
|-----------|----------|--------|-----------------|--------------|-----------|-----------|--------|------|-------------|
| Alertas críticos derivados | PARCIAL | Visão Geral + Prioridades | KPIs atuais + regras | — | Não (recalculados) | Boa para sinais atuais | Sem ciclo de vida (responsável, prazo, situação) | Fase 1: derivar; Fase 2: opcional `DirectorAlert` | Cache domínio |
| Qualidade dos dados | DERIVÁVEL | Visão Geral | Metadados de cada domínio | `updatedAt`, contagens nulas | Não | Depende de cobertura | Sem score formal | Fase 1: flags por domínio | Por request |
| Prazos institucionais | PARCIAL | Visão Geral + Prioridades | `EmployeeContract.endDate`, `PayrollMonth`, doações | datas | Não | Parcial | Sem agenda unificada de projetos | Fase 1: contratos/folha; Fase 2+: projetos | Diária |
| Variações do período | PARCIAL | Visão Geral | Comparar dois recortes | — | Fraco sem snapshot | Baixa para tendência longa | Sem série congelada | Fase 1: MoM simples; Fase 2: snapshots | — |

---

## Acadêmico

| Indicador | Situação | Página | Origem | Campos | Histórico | Qualidade | Lacuna | Ação |
|-----------|----------|--------|--------|--------|-----------|-----------|--------|------|
| Pré-matrículas | DERIVÁVEL | Acadêmico | `Enrollment` | `isPreEnrollment`, `enrollmentConfirmedAt` | `createdAt` | Alta | Fora do painel atual | Agregar Fase 1 |
| Matrículas confirmadas | DERIVÁVEL | Acadêmico | `Enrollment` | `status`, `isPreEnrollment=false` | `enrolledAt` | Alta | Painel mistura pré+confirmada | Separar Fase 1 |
| Aceite de vaga (oferta) | DERIVÁVEL | Acadêmico / Oferta | `WaitlistSeatOffer` | `status`, `acceptedAt`, `expiresAt` | Sim | Alta | Não no Diretor | Agregar Fase 1 |
| Lista de espera | DERIVÁVEL | Oferta | `EnrollmentWaitlist` | `status=WAITING` | `createdAt` | Alta | Idem | Agregar Fase 1 |
| Primeira presença | DERIVÁVEL | Acadêmico | `SessionAttendance` | `present=true`, min data | Por sessão | Média | Sem campo dedicado | Query Fase 1 |
| Alunos ativos | EXISTENTE | Acadêmico | `Enrollment` | `ACTIVE` (+regra turma) | Status atual | Alta | — | Manter |
| Frequência (% presença) | EXISTENTE | Acadêmico | `ClassSession` + `SessionAttendance` | `sessionDate`, `present` | Por sessão | Alta | Critério status sessão vs streak | Formalizar Fase 0/1 |
| Faltas justificadas / não | DERIVÁVEL | Acadêmico | `SessionAttendance` | `present`, `absenceJustification` | Por sessão | Alta | Não no painel | Separar taxas Fase 1 |
| Suspensão | EXISTENTE | Acadêmico | `Enrollment.status` | `SUSPENDED` | AuditLog parcial | Alta | Motivo só em audit | Contar + link |
| Risco de evasão (sinais) | PARCIAL | Acadêmico + Prioridades | Streak + ausência % + progresso | streak libs | Atual | Média | Só streak 4 hoje; thresholds não validados | Fase 1: sinal streak/suspensão; Fase 5: preditivo |
| Evasão confirmada | PARCIAL / NOVO_MODELO | Acadêmico | `CANCELLED` + 1ª presença + exclusões | status, attendances | Fraco | Baixa sem motivo | Sem motivo estruturado; transferência não tipada | Fase 1 heurística; Fase 2 motivo/histórico |
| Cancelamento antes do início | DERIVÁVEL | Acadêmico | `CANCELLED` sem presença / antes `startDate` | — | Heurística | Média | Sem flag | Reportar como “não iniciou” |
| Transferência | PARCIAL | Acadêmico | PATCH `classGroupId` | — | AuditLog? | Baixa | Não há status TRANSFERRED | Fase 2 tipar evento |
| Retenção por coorte | PARCIAL | Acadêmico | matrículas + sessões | — | Precisa checkpoints | Média | Sem snapshot de coorte | Fase 1 checkpoints simples; Fase 2 hist |
| Conclusão | PARCIAL | Acadêmico | `COMPLETED`, turma `ENCERRADA` | status | Atual | Média | Denominador ambíguo | Formalizar denom. |
| Certificação elegível vs emitida | DERIVÁVEL | Acadêmico | `certificateEligible`, `certificateIssuedAt`, `certificateUrl` | — | Datas emissão | Alta | Não no painel | Separar Fase 1 |
| Progresso de aulas | DERIVÁVEL | Acadêmico | `EnrollmentLessonProgress` | `completed`, % | Por aula | Alta | Só tops no Diretor | Agregar |
| Exercícios | DERIVÁVEL | Acadêmico | `EnrollmentLessonExerciseAnswer` | acertos | Por resposta | Alta | Via gamificação parcial | Agregar |
| Provas / aprendizagem | DERIVÁVEL | Acadêmico | `ClassGroupExamAttempt` | `scorePercent`, status | Por tentativa | Média | Escalas diferentes entre provas | % acima do critério / evolução; não média bruta global |
| Motivo de saída | NOVO_MODELO | Acadêmico | — | — | Não | — | Campo inexistente | Fase 2 |
| Emprego / renda egresso | NOVA_COLETA | Impacto | — | — | Não | — | Sem CRM egressos | Fase 4 |

---

## Oferta e Territórios

| Indicador | Situação | Página | Origem | Campos | Histórico | Qualidade | Lacuna | Ação |
|-----------|----------|--------|--------|--------|-----------|-----------|--------|------|
| Vagas / capacidade | EXISTENTE | Oferta | `ClassGroup.capacity` | capacity | Atual | Alta | — | Manter |
| Ocupação atual | EXISTENTE | Oferta | ACTIVE+SUSPENDED / capacity | status | Atual | Alta | — | Manter nome “atual” |
| Ocupação inicial | PARCIAL | Oferta | Heurística em `startDate` | enrolledAt, AuditLog | Fraco | Baixa–média | Sem snapshot | Fase 1 aproximar; Fase 2 snapshot |
| Demanda por vaga (únicos) | DERIVÁVEL | Oferta | pré + waitlist + offers | studentId | Período | Média | Deduplicar pessoa | Query única por studentId |
| Tempo para preenchimento | DERIVÁVEL | Oferta | datas matrícula vs abertura | — | — | Média | Definição de “aberta” | Fase 1 |
| Turmas baixa ocupação | EXISTENTE | Oferta | KPIs atuais | — | — | Alta | — | Página temática |
| Polos / territórios | EXISTENTE | Oferta | `Polo`, `PoloLocation`, `location` | — | — | Alta | Texto livre em location | Preferir polo |
| Horários mais procurados | DERIVÁVEL | Oferta | `daysOfWeek`, `TimeSlot`, demanda | — | — | Média | — | Heatmap Fase 1 |
| Capacidade docente | PARCIAL | Oferta | `ClassGroupTeacher`, turmas | — | Atual | Média | Sem “capacidade máxima” formal | Carga = nº turmas |
| Matriz demanda × conclusão | DERIVÁVEL | Oferta | combinar demanda + COMPLETED | — | — | Média | — | Quadrantes Fase 1 |

---

## Impacto Social

| Indicador | Situação | Página | Origem | Campos | Histórico | Qualidade | Lacuna | Ação |
|-----------|----------|--------|--------|--------|-----------|-----------|--------|------|
| Beneficiários únicos (alunos) | DERIVÁVEL | Impacto | `Student` + matrículas elegíveis | `studentId` | Por período | Alta | Definir “atendimento elegível” | Fase 1 |
| Novos vs recorrentes / multi-curso | DERIVÁVEL / EXISTENTE parcial | Impacto | matrículas multi | — | — | Alta | — | Fase 1 |
| Meta pessoas / ano | PARCIAL | Impacto | `AnnualGoal.peopleTarget` | year | Ano | Baixa no realizado | Sem peopleDone | Fase 1: meta vs únicos; Fase 2 cálculo oficial |
| Computadores doados vs meta | EXISTENTE / DERIVÁVEL | Impacto | `AnnualGoal` + doações | computersTarget, kits | Ano | Alta no realizado | — | Reusar lógica `metas` API |
| Donatárias / termos / kits | EXISTENTE | Impacto | `Donation`, `Donataria` | status CONFIRMADA | Datas doação | Alta | Já no resumo Diretor | Página temática |
| Equipamentos fluxo status | PARCIAL | Impacto / Admin | `InventoryItem` + movements | condition, qty | Movimentos qtd | Baixa p/ pipeline | Sem estados unitários | Fase 1 saldo; Fase 2 histórico status |
| Visitas técnicas | DERIVÁVEL | Impacto / Projetos | `TechnicalVisit` | classification, metas | visitedAt | Média | — | Listar Fase 1 |
| Comunidades / territórios | PARCIAL | Impacto | polo, cidade aluno, donatária | — | — | Média | Público prioritário LGPD | Agregar cuidadoso |
| Egressos 30/90/180 | NOVA_COLETA | Impacto | — | — | — | — | Sem model | Fase 4 |
| Satisfação plataforma | DERIVÁVEL | Impacto (secundário) | `PlatformExperienceFeedback` | scores | createdAt | Média | Não é impacto social causal | Opcional Fase 1 com rótulo |
| Causalidade impacto | NÃO_RECOMENDADO | — | — | — | — | — | Sem método | Não declarar |

---

## Financeiro

| Indicador | Situação | Página | Origem | Campos | Histórico | Qualidade | Lacuna | Ação |
|-----------|----------|--------|--------|--------|-----------|-----------|--------|------|
| Receitas lançadas / pagas | EXISTENTE | Financeiro | `FinancialEntry` ENTRADA | amountCents, paymentStatus, paidAt, entryDate | Por lançamento | Alta | Não é “caixa” | Rotular corretamente |
| Despesas lançadas / pagas | EXISTENTE | Financeiro | SAIDA + expenseNature | — | — | Alta | — | Idem |
| Movimentação líquida (lançamentos) | DERIVÁVEL | Financeiro | entradas − saídas (definir pago vs competência) | — | — | Média | Nomeação | Fase 1 |
| Contas a pagar / receber | DERIVÁVEL | Financeiro | EM_ABERTO / PENDENTE | entryDate, paidAt | — | Alta | — | Fase 1 |
| Por categoria / natureza / polo | EXISTENTE | Financeiro | categoryId, expenseNature, poloId | — | — | Alta | — | Fase 1 |
| Folha prevista vs realizada | PARCIAL | Financeiro / Admin | `PayrollMonth`/`PayrollLine` | referenceMonth, status, paidAt | Competência | Alta | — | Fase 1 |
| FundingChannel | PARCIAL | Financeiro | `Employee`, `PayrollLine` | CONVENIO/POR_FORA | Folha | Média | **Não** em FinancialEntry | Mostrar na folha; não generalizar |
| Orçamento / execução % | NOVO_MODELO | Financeiro | — | — | — | — | Ausente | Fase 3 |
| Recursos livres vs vinculados | NOVO_MODELO | Financeiro | — | — | — | — | Ausente | Fase 3 |
| Centro de custo / rateio | NOVO_MODELO | Financeiro | — | — | — | — | Ausente | Fase 3 |
| Previsão / fluxo projetado | NOVO_MODELO / PARCIAL | Financeiro | EM_ABERTO como proxy fraco | — | — | Baixa | Sem forecast | Fase 1: só abertos; Fase 3 forecast |
| Disponibilidade / meses de reserva | NÃO_RECOMENDADO (agora) | — | — | — | — | — | Sem saldo bancário | Fase 3 após modelo |
| Custo por aluno / concluinte | PARCIAL | Financeiro | despesas + alunos | — | — | Baixa | Sem rateio | Fase 3 |
| Concentração de fontes | PARCIAL | Financeiro | supplier? / folha funding | — | — | Baixa | Sem fonte no lançamento | Fase 3 |
| Concilição | NOVO_MODELO | — | — | — | — | — | Ausente | Fase 3+ |

---

## Projetos e Convênios

| Indicador | Situação | Página | Origem | Campos | Histórico | Qualidade | Lacuna | Ação |
|-----------|----------|--------|--------|--------|-----------|-----------|--------|------|
| Meta anual computadores/pessoas | EXISTENTE / PARCIAL | Projetos / Impacto | `AnnualGoal` | year, targets | Ano | Parcial | Sem vínculo projeto | Fase 1 com disclaimer |
| Convênio de pagamento (RH) | EXISTENTE | Administrativo | `PaymentAgreement` | name, employees | — | Alta | **Não** é projeto | Não listar como convênio institucional |
| Convênio/projeto institucional | NOVO_MODELO | Projetos | — | vigência, metas, órgão | — | — | Ausente | Fase 2 após aprovação |
| Prestação de contas (import) | PARCIAL | Financeiro / Projetos | importação prestação | — | Arquivos | Média | Sem entidade projeto | Mapear o que o import grava |
| Visitas × metas pedagógicas | DERIVÁVEL | Projetos | `TechnicalVisit` | metaStudents, classification | visitedAt | Média | — | Fase 1 |
| Beneficiários previstos vs realizados (projeto) | NOVO_MODELO | Projetos | — | — | — | — | Sem projeto | Fase 2–4 |
| NF / evidências por projeto | PARCIAL | Projetos | anexos FinancialEntry, Donation | — | — | Baixa vínculo | Sem FK projeto | Fase 2 |

---

## Administrativo

| Indicador | Situação | Página | Origem | Campos | Histórico | Qualidade | Lacuna | Ação |
|-----------|----------|--------|--------|--------|-----------|-----------|--------|------|
| Colaboradores ativos / docs | EXISTENTE | Administrativo | `Employee`, `EmployeeDocument` | status, docs | — | Alta | Já no resumo | Página |
| Contratos vencimento | DERIVÁVEL | Administrativo | `EmployeeContract` | status, datas | — | Alta | — | Fase 1 |
| Folha / vale-refeição | EXISTENTE | Administrativo | Payroll*, MealTicket* | — | Competência | Alta | — | Fase 1 |
| Estoque / baixo mínimo | EXISTENTE | Administrativo | `InventoryItem` | quantityOnHand, minStock | Movimentos | Alta | — | Fase 1 |
| Materiais sem movimentação | DERIVÁVEL | Administrativo | `InventoryMovement` | createdAt | Sim | Média | — | Fase 1 |
| Equipamentos por etapa | PARCIAL | Administrativo | condition + qty | — | Fraco | Baixa | Pipeline | Fase 2 model |
| Fila e-mail falhas | DERIVÁVEL | Administrativo | `EmailOutbox` FAILED | errorMessage, attempts | createdAt/sentAt | Alta | Atraso inferido | Traduzir impacto Fase 1 |
| Campanhas e-mail/SMS | DERIVÁVEL | Administrativo | Campaign + recipients | totalFailed, status | — | Alta | Diretor sem API hoje | Endpoints read-only Fase 1 |
| Cron / backup histórico | NOVO_MODELO | Administrativo | — | — | Não | — | vercel.json só schedule | Fase 2 log runs |
| SMS automático no deploy | PARCIAL | Admin ops | `vercel.json` + rotas SMS | — | — | Verificar ambiente | Auditar se cron SMS existe | Checklist Fase 0 ops |

---

## Relatórios / infraestrutura analítica

| Item | Situação | Ação |
|------|----------|------|
| Export sob demanda | DERIVÁVEL | Fase 1B JSON/CSV; PDF/XLSX só na Fase 1C se aprovados |
| Snapshot imutável | NOVO_MODELO | Fase 2 `IndicatorSnapshot` / `DirectorReport` (fora da 1C) |
| Catálogo de indicadores no código | NOVO (código, não DB) | Fase 1 módulo TS compartilhado |
| Histórico execução cron | NOVO_MODELO | Fase 2 |
| EnrollmentStatusHistory | NOVO_MODELO | Fase 2 |
| Motivo saída | NOVO_MODELO | Fase 2 |
| Orçamento / fonte / CC | NOVO_MODELO | Fase 3 |
| EgressoFollowUp | NOVO_MODELO + NOVA_COLETA | Fase 4 |

**Fase 1C não inclui** models novos nem migrations (`InstitutionalProject`, `GrantAgreement`, orçamento, snapshots persistentes).


---

## LGPD (impacto por tipo)

| Tipo de dado | Risco | Regra proposta |
|--------------|-------|----------------|
| Agregados curso/turma/polo | Baixo | Padrão do Diretor |
| Listas nominais de alunos em risco | Alto | Evitar na Visão Geral; se Prioridades/Acadêmico, papel restrito + n mínimo + sem export amplo sem log |
| CPF | Alto | Não usar na camada analítica; `studentId` interno |
| Menores | Alto | Sem drilldown identificável; agregar |
| Feedbacks nominais | Médio | Agregar scores; comentários só se política permitir |

---

## Models reutilizáveis (prioridade)

`Cycle`, `ClassGroup`, `ClassSession`, `SessionAttendance`, `Enrollment`, `EnrollmentWaitlist`, `WaitlistSeatOffer`, `Student`, `Course`, `Polo`, `PoloLocation`, `ClassGroupExam*`, `EnrollmentLessonProgress`, `EnrollmentLessonExerciseAnswer`, `FinancialEntry`, `FinancialCategory`, `PayrollMonth`, `PayrollLine`, `MealTicket*`, `Employee`, `EmployeeContract`, `EmployeeDocument`, `InventoryItem`, `InventoryMovement`, `Donation*`, `Donataria`, `AnnualGoal`, `TechnicalVisit`, `EmailOutbox`, `EmailCampaign*`, `SmsCampaign*`, `PlatformExperienceFeedback`, `AuditLog`, `OnboardingGuide`.

## Novos models possíveis (somente se aprovados nas fases)

Ver seção correspondente em `plano-dashboard-diretor-v2.md` e detalhe em `arquitetura-paginas-e-apis.md` § estruturas novas.
