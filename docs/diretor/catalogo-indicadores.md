# Catálogo de indicadores — perfil Diretor

**Status:** decisões aprovadas incorporadas (21/08/2026)  
**Uso:** cada indicador no código deve ter `metricId`, `formulaVersion`, fórmula, denominador, unidade, período, qualidade, fonte e data de referência.

Convenções:

- **Sentido desejável:** `↑` · `↓` · `→`
- **Dado ausente:** `Indisponível` / `Não calculável` — nunca `0` quando falta denom./fonte
- **LGPD:** `MIN_AGGREGATE_GROUP_SIZE = 5`; grupos pequenos → `<5` em recortes sensíveis; sem listas nominais/CPF

---

## 0. Correções aprovadas (resumo)

1. Streak ≥4 ≠ evasão confirmada → `acad.attrition.risk.critical_absences` (“Risco crítico por faltas”).
2. Frequência: denom. = oportunidades elegíveis aluno×sessão (`LIBERADA`, ≤ dataAsOf, após entrada do aluno).
3. Conclusão principal só em coortes encerradas: COMPLETED∩iniciou ÷ iniciou.
4. Beneficiário atendido = presença elegível; separar confirmados/concluintes/doações.
5. Sem alerta de ritmo linear 80% no 2º semestre.
6. Comparações por domínio; senão “histórico indisponível”.

---

## A. Definições transversais

### A.1 Pessoas confirmadas únicas (`ben.confirmed_unique`)

Contagem de `studentId` distintos com matrícula confirmada (`isPreEnrollment=false`) no período. **Não** é beneficiário atendido.

### A.1b Beneficiário / aluno efetivamente atendido (`ben.served_unique`)

| Campo | Valor |
|-------|--------|
| Definição | `studentId` distinto com **≥1 presença elegível** no período |
| Não usar | Somente `enrolledAt` / `enrollmentConfirmedAt` |
| Separar | Beneficiários institucionais de doações (`soc.donation.institutional`) |

### A.1c Comparação com `AnnualGoal.peopleTarget`

Só se a definição oficial da meta for a mesma de `ben.served_unique`. Caso contrário: exibir meta e realizado **separados** com aviso “definição pendente”. **Sem** criticidade por ritmo linear.

### A.2 Matrícula vs beneficiário

- **Matrícula:** `Enrollment`
- **Confirmado único / Atendido único / Concluinte único:** pessoa (`studentId`)
- Nunca rotular “beneficiários” com contagem de matrículas sem explicitar

### A.3 Ocupação inicial (`offer.occupancy.initial`)

Estimativa na Fase 1; **não** entra na Visão Geral. Qualidade = aproximada.

### A.4 Ocupação atual (`offer.occupancy.current`)

`COUNT(ACTIVE∪SUSPENDED) ÷ capacity` — EXISTENTE.

### A.5 Demanda por vaga (`offer.demand.per_seat`)

Pessoas candidatas únicas (pré + waitlist, dedupe) ÷ vagas. DERIVÁVEL.

### A.6 Taxa de início (`acad.start_rate`)

Confirmados com ≥1 presença ÷ confirmados elegíveis (excluir cancelamento pré-início quando aplicável).

### A.7 Frequência — presença (`acad.attendance.present_rate`)

| Campo | Valor |
|-------|--------|
| Fórmula | Presenças ÷ **oportunidades elegíveis** (aluno × sessão) |
| Sessão elegível | `status = LIBERADA` ∧ instante ≤ `dataAsOf` ∧ não futura ∧ respeita data de entrada do aluno |
| Qualidade | Contar sessões `SCHEDULED` com data passada como problema de qualidade |
| Justificada no denom. | Sim (presença numerador 0) |
| Taxas irmãs | `justified_rate`, `unjustified_rate` com o **mesmo** denominador |

### A.8 / A.9 Falta justificada / não justificada

Mesmo denominador de oportunidades elegíveis.

### A.9b Risco crítico por faltas (`acad.attrition.risk.critical_absences`)

Alunos **ainda vinculados** (ACTIVE/SUSPENDED) com streak de faltas não justificadas ≥ `CANCEL_LIMIT` (4), usando sessões elegíveis canônicas. **Não** chamar evasão.

### A.10 Evasão confirmada (`acad.attrition.confirmed`)

Somente com motivo estruturado + histórico (Fase 2+). Até lá: **não implementar** como “evasão”.

### A.10b Cancelamentos após o início — motivo não tipado (`acad.cancel.after_start_untyped`)

`CANCELLED` com ≥1 presença; qualidade parcial. Não é evasão confirmada.

### A.11 Suspensão

≥3 faltas consecutivas s/ justificativa — operacional existente.

### A.12 Cancelamento automático por faltas

Já SUSPENDED + streak ≥4 — “Cancelamentos por faltas consecutivas” quando comprovável via fluxo/audit.

### A.14 Conclusão principal (`acad.completion.started_rate`)

| Campo | Valor |
|-------|--------|
| Fórmula | COMPLETED ∩ iniciou ÷ coorte que iniciou |
| Início | ≥1 presença elegível |
| Escopo | Apenas turmas/coortes **ENCERRADA** (maduras) |
| Auxiliares | conclusão entre confirmados; taxa de não início; cancelamentos após início |

---

## B. Indicadores por página (catálogo operacional)

### B.1 Visão Geral (máx. 6 KPIs — candidatos)

| id | Nome | Situação | Fórmula resumida | Meta | Alerta |
|----|------|----------|------------------|------|--------|
| `ov.ben.vs_goal` | Beneficiários × meta anual pessoas | PARCIAL | únicos período ÷ `AnnualGoal.peopleTarget` | AnnualGoal | &lt;80% no 2º semestre |
| `ov.completion` | Taxa de conclusão (recorte) | PARCIAL | ver A.14 | a definir | queda MoM |
| `ov.attrition.risk` | Em risco de evasão | PARCIAL | count risco | ↓ | ↑ absoluto |
| `ov.demand_occupancy` | Demanda / ocupação | DERIVÁVEL | síntese oferta | → | turmas &lt;30% |
| `ov.goals.execution` | Execução metas institucionais | PARCIAL | computadores doados ÷ meta; pessoas se disponível | AnnualGoal | atraso |
| `ov.finance.movement` | Movimentação líquida de lançamentos (mês) | DERIVÁVEL | pagos ENTRADA − SAIDA | — | **não** chamar caixa |

Se `ov.finance.movement` for o único financeiro: subtítulo obrigatório *“Com base em lançamentos pagos; não representa disponibilidade bancária.”*

### B.2 Prioridades (atributos do alerta, não KPIs)

Cada alerta deve carregar: id, domínio, criticidade, título, fato, valor, denominador, período, qtd afetada, tendência, persistência, impacto, decisão sugerida, responsável operacional (quando conhecido), prazo, situação, fonte, regra, link `/diretor/...`.

Persistência de “situação da providência”: Fase 1 = só derivado; Fase 2 = model opcional.

### B.3 Acadêmico — principais

| id | Nome | Situação | Unidade | Sentido | Período |
|----|------|----------|---------|---------|---------|
| `acad.pre_enroll.count` | Pré-matrículas | DERIVÁVEL | matrículas | ↑/→ | ciclo |
| `acad.enroll.confirmed` | Matrículas confirmadas | DERIVÁVEL | matrículas | ↑ | ciclo |
| `acad.seat_offer.accept_rate` | Taxa de aceite de ofertas | DERIVÁVEL | % | ↑ | ciclo |
| `acad.start_rate` | Taxa de início | DERIVÁVEL | % | ↑ | ciclo |
| `acad.active` | Alunos ativos | EXISTENTE | matrículas | → | ciclo |
| `acad.attendance.present_rate` | Frequência (presença) | EXISTENTE | % | ↑ | sessões ocorridas |
| `acad.attendance.justified_rate` | Faltas justificadas | DERIVÁVEL | % | → | sessões ocorridas |
| `acad.attendance.unjustified_rate` | Faltas não justificadas | DERIVÁVEL | % | ↓ | sessões ocorridas |
| `acad.suspension.count` | Suspensos | EXISTENTE | matrículas | ↓ | ciclo |
| `acad.attrition.risk` | Risco de evasão | PARCIAL | pessoas/matrículas | ↓ | ciclo |
| `acad.attrition.risk.streak4` | Sinal 4 faltas consecutivas | EXISTENTE (hoje “evasão”) | matrículas | ↓ | ciclo |
| `acad.attrition.confirmed` | Evasão confirmada | PARCIAL | % ou n | ↓ | ciclo |
| `acad.retention.cohort` | Retenção | PARCIAL | % | ↑ | coorte |
| `acad.completion.rate` | Conclusão | PARCIAL | % | ↑ | ciclo |
| `acad.cert.eligible` | Aptos a certificado | DERIVÁVEL | n | ↑ | ciclo |
| `acad.cert.issued` | Certificados emitidos | DERIVÁVEL | n | ↑ | ciclo |
| `acad.progress.lesson_pct` | Progresso médio aulas | DERIVÁVEL | % | ↑ | ciclo |
| `acad.learning.exam_pass_pct` | % acima do critério em provas | DERIVÁVEL | % | ↑ | ciclo |

**Gráficos (ligados a perguntas):** funil jornada; retenção coorte; frequência ao longo das sessões; distribuição frequência; J vs F; frequência × desempenho (dispersão); evolução exercícios/provas; conclusão por curso/turma; motivos de saída (Fase 2).

**Filtros:** ciclo, curso, turma, polo, professor, status matrícula, período de sessão.

**Não incluir:** financeiro, folha, estoque, contratos.

### B.4 Oferta e Territórios

| id | Nome | Situação |
|----|------|----------|
| `offer.seats.offered` | Vagas ofertadas | EXISTENTE |
| `offer.seats.occupied` | Vagas ocupadas | EXISTENTE |
| `offer.occupancy.initial` | Ocupação inicial | PARCIAL |
| `offer.occupancy.current` | Ocupação atual | EXISTENTE |
| `offer.demand.per_seat` | Demanda por vaga | DERIVÁVEL |
| `offer.waitlist.count` | Lista de espera | DERIVÁVEL |
| `offer.fill_time` | Tempo para preenchimento | DERIVÁVEL |
| `offer.low_occupancy.classes` | Turmas baixa ocupação | EXISTENTE |
| `offer.territory.occupancy` | Ocupação por território | EXISTENTE |
| `offer.heatmap.schedule` | Demanda por dia/hora | DERIVÁVEL |
| `offer.teacher.load` | Carga docente | PARCIAL |
| `offer.matrix.demand_completion` | Quadrantes demanda×conclusão | DERIVÁVEL |

**Quadrantes:** alta demanda/alta conclusão → ampliar; alta/baixa → revisar execução; baixa/alta → divulgação; baixa/baixa → reavaliar oferta.

**Filtros:** ciclo, período de inscrição, curso, polo, horário.

### B.5 Impacto Social

| id | Nome | Situação | Camada |
|----|------|----------|--------|
| `soc.ben.unique` | Beneficiários únicos | DERIVÁVEL | produto |
| `soc.ben.new` | Novos | DERIVÁVEL | produto |
| `soc.ben.returning` | Recorrentes / multi-curso | DERIVÁVEL | produto |
| `soc.completers` | Concluintes | PARCIAL | produto/resultado |
| `soc.certs` | Certificados | DERIVÁVEL | produto |
| `soc.territories` | Territórios atendidos | PARCIAL | produto |
| `soc.equipment.donated` | Equip./kits doados | EXISTENTE | produto |
| `soc.goal.computers` | Meta computadores | EXISTENTE | produto |
| `soc.goal.people` | Meta pessoas | PARCIAL | produto |
| `soc.visits` | Visitas técnicas | DERIVÁVEL | produto |
| `soc.egress.*` | Emprego/renda/continuidade | NOVA_COLETA | resultado/impacto |
| `soc.partner.satisfaction` | Satisfação parceiros | NOVA_COLETA | resultado |

**Filtros:** período, polo, curso, (futuro) projeto/convênio.

### B.6 Financeiro

| id | Nome | Situação | Nomeação correta |
|----|------|----------|------------------|
| `fin.revenue.posted` | Receitas lançadas | EXISTENTE | lançamentos ENTRADA |
| `fin.revenue.paid` | Receitas pagas/recebidas | EXISTENTE | `paymentStatus=PAGO` + `paidAt` |
| `fin.expense.posted` | Despesas lançadas | EXISTENTE | |
| `fin.expense.paid` | Despesas pagas | EXISTENTE | |
| `fin.movement.net_paid` | Movimentação líquida (pagos) | DERIVÁVEL | **não** caixa/resultado |
| `fin.ap` | Contas a pagar | DERIVÁVEL | EM_ABERTO/PENDENTE SAIDA |
| `fin.ar` | Contas a receber | DERIVÁVEL | ENTRADA em aberto |
| `fin.by_category` | Por categoria | EXISTENTE | |
| `fin.by_nature` | Fixa/variável | EXISTENTE | SAIDA |
| `fin.by_polo` | Por polo | EXISTENTE | |
| `fin.payroll` | Folha competência | EXISTENTE | PayrollMonth |
| `fin.budget.execution` | Execução orçamentária | NOVO_MODELO | Fase 3 |
| `fin.reserve.months` | Meses de reserva | NÃO_RECOMENDADO agora | Fase 3 |
| `fin.cost.per_completer` | Custo por concluinte | PARCIAL | Fase 3 + rateio |
| `fin.concentration` | Concentração fontes | PARCIAL | Fase 3 |

**Filtros:** competência (folha), intervalo `entryDate`/`paidAt`, categoria, natureza, polo, status pagamento. **Sem ciclo acadêmico.**

### B.7 Projetos e Convênios

| id | Nome | Situação | Nota |
|----|------|----------|------|
| `proj.annual_goal` | Metas anuais | PARCIAL | Único “projeto-like” hoje |
| `proj.visits.portfolio` | Visitas | DERIVÁVEL | |
| `proj.institutional.*` | Portfólio convênios | NOVO_MODELO | Não usar PaymentAgreement |

### B.8 Administrativo

| id | Nome | Situação |
|----|------|----------|
| `adm.employees.active` | Colaboradores ativos | EXISTENTE |
| `adm.docs.pending` | Docs pendentes | EXISTENTE |
| `adm.contracts.expiring` | Contratos a vencer | DERIVÁVEL |
| `adm.payroll.status` | Folha | EXISTENTE |
| `adm.meals` | Vale-refeição | EXISTENTE |
| `adm.inventory.low` | Estoque baixo | EXISTENTE |
| `adm.inventory.stale` | Sem movimentação | DERIVÁVEL |
| `adm.email.failures` | Falhas de e-mail | DERIVÁVEL |
| `adm.comms.impact` | Impacto em alunos (traduzido) | DERIVÁVEL |
| `adm.cron.health` | Saúde de rotinas | NOVO_MODELO |

---

## C. Metas, comparação, alertas (padrão)

Para cada indicador implementado:

- **Meta:** de `AnnualGoal`, configuração futura `IndicatorTarget`, ou banda institucional.
- **Comparação:** mesmo período ano anterior; ciclo anterior; meta.
- **Limites de alerta:** documentar no código junto ao `id`.
- **Frequência:** acadêmico tipicamente a cada cache 1–5 min; financeiro pode ser mais longo; relatórios sob demanda.
- **Data de referência:** sempre exibir.

---

## D. Testes mínimos por família

1. Numerador/denominador e divisão por zero → `Não calculável`.
2. Status incluídos/excluídos (ACTIVE, SUSPENDED, CANCELLED, COMPLETED, pré-matrícula).
3. Fronteiras de data (início/fim ciclo; sessão à meia-noite Brasil).
4. Sessões futuras fora da frequência.
5. Justificada vs não justificada.
6. Transferência (quando tipada) ≠ evasão.
7. Cancelamento antes da 1ª presença ≠ evasão confirmada.
8. Beneficiário único com multi-matrícula.
9. Duplicidade de waitlist/pré.
10. Financeiro: PAGO vs EM_ABERTO; soft-delete `deletedAt`; não rotular caixa.

---

## E. Relação com o Guia do Diretor

O Guia (`/diretor/guia`) deve ser gerado a partir deste catálogo (ou do módulo TS espelho na Fase 1), evitando texto paralelo divergente no seed de onboarding.

---

## F. Chamada incompleta (Fase 1A — regra canônica)

Oportunidade elegível **sem** `SessionAttendance`:
- **não** é convertida em falta justificada/não justificada;
- permanece no **denominador** das taxas (`presentRate` etc.);
- `callCompletenessRate = marcadas ÷ oportunidades`;
- `quality = partial` quando `unmarkedCount > 0`;
- streak operacional: sessão sem lançamento é **ignorada** (não incrementa nem zera).

Versão das fórmulas implementadas na 1A: `1A.0.0`.
