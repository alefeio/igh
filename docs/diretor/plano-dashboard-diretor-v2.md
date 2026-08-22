# Plano de evolução do perfil Diretor — Dashboard v2

**Status:** direção geral aprovada com decisões obrigatórias (21/08/2026)  
**Fonte definitiva:** código atual em `cadastro-cursos`  
**Escopo:** área executiva multipágina, somente leitura  
**Implementação autorizada agora:** apenas **Fase 1A** (ver §5.1)

---

## 0. Decisões aprovadas (obrigatórias)

1. **Home definitiva** = `/diretor`. Redirect de `/dashboard` → `/diretor` **somente** para papel ativo `DIRECTOR`, e **somente após validação** da nova área. Na Fase 1A o dashboard antigo permanece como fallback; **sem** redirect definitivo.
2. **Renomear KPI “evasão” (streak 4):** usar “Risco crítico por faltas” / “Casos no limite de cancelamento” (ainda vinculados); “Cancelamentos por faltas consecutivas” só com comprovação; “Evasão confirmada” só com motivo+histórico (futuro). Sem dual-label. Cancelamentos pós-início sem tipagem = “Cancelamentos após o início — motivo não tipado” (qualidade parcial).
3. **Sessões elegíveis canônicas** (uma função compartilhada): status operacional `LIBERADA`; data/hora ≤ `dataAsOf`; excluir futuras e `CANCELED`; respeitar entrada do aluno. Sessões passadas não liberadas = **qualidade dos dados**, não omissão silenciosa. Enums reais: `SCHEDULED` | `LIBERADA` | `CANCELED`.
4. **Frequência agregada:** denominador = oportunidades elegíveis **aluno × sessão**. Presença / justificada / não justificada usam o mesmo denominador. Justificada permanece no denom. da presença.
5. **Conclusão principal:** `COMPLETED que iniciaram ÷ coorte que iniciaram` (início = ≥1 presença). Só turmas/coortes **encerradas e maduras**. Auxiliares: conclusão entre confirmados; não início; cancelamentos após início.
6. **Beneficiários:** separar pessoas confirmadas únicas; atendidos únicos (≥1 presença elegível); concluintes únicos; beneficiários institucionais de doações. Não definir beneficiário só por data de matrícula. Meta `peopleTarget` só comparável se definição oficial for compatível; senão meta e realizado separados com aviso.
7. **Sem alerta** “&lt;80% no 2º semestre” por ritmo linear. Só realizado × meta anual até existir marcos.
8. **Comparações:** financeiro MoM/YoY; acadêmico ciclo anterior ou ponto de coorte; conclusão só coortes encerradas; sem “queda MoM” genérica acadêmica; senão “histórico indisponível”.
9. **Ocupação inicial** na Fase 1 = estimativa; **fora da Visão Geral**. Tempo para preenchimento só com data de abertura confiável. Matriz demanda×conclusão só turmas encerradas comparáveis.
10. **`/diretor/projetos-convenios`:** planejada; Fase 1 = AnnualGoal + resumo visitas/doações + estado “cadastro institucional inexistente”. Não usar `PaymentAgreement` como convênio.
11. **Alertas derivados** na Fase 1 (sem `DirectorAlert`/ack). Campos ausentes se não houver dado real. Diretor sem botões de providência. Persistência = Fase 2 (Gerência registra).
12. **Relatórios Fase 1** sob demanda (PDF/Excel + audit); snapshot imutável = Fase 2.
13. **LGPD:** `MIN_AGGREGATE_GROUP_SIZE = 5`; `<5` em recortes sensíveis; sem listas nominais; sem CPF nos endpoints analíticos.
14. **Master** visualiza `/diretor` em leitura com banner “Visualização do perfil Diretor” (sem impersonação).
15. **Catálogo no código:** `metricId`, `formulaVersion`, fórmula, denominador, unidade, período, qualidade, fonte, `dataAsOf`. Nenhuma página recalcula localmente.

### Fase 1A (autorizada)

Docs atualizados + catálogo tipado + sessões elegíveis + Zod/params + shell `/diretor` + preview Master + páginas/APIs: overview, prioridades, acadêmico, oferta-territórios, guia + métricas acadêmicas/oferta + pré/waitlist/ofertas + testes + medição vs monolito + fallback do dashboard antigo.

**Fora da 1A:** migrations, models novos, alertas persistentes, snapshots, orçamento, convênios institucionais, egressos, predição, listas nominais, redirect definitivo, remoção do dashboard antigo, financeiro/admin/social completos.

---

## 1. Diagnóstico (código atual)

### 1.1 O que já existe

| Peça | Local | Situação |
|------|-------|----------|
| Enum `DIRECTOR` | `prisma/schema.prisma` + migration `20260821120000_user_role_director` | Aplicada |
| Criação só Master | `src/app/api/admin/users/*`, UI `/users` | OK |
| Somente leitura Gerência | `hasAdminManagementAccess` retorna `false` para `DIRECTOR`; proxy bloqueia `/admin/gerencia` | OK |
| Entrada única | `/dashboard` → `DirectorDashboard` | Monolítico |
| Agregação | `src/lib/director-dashboard-data.ts` (~1.1k linhas) | Um payload para tudo |
| API | `GET /api/diretor/dashboard` | Um endpoint, cache ~90s |
| Menu | Sidebar: Página Inicial + Como usar (+ portal colaborador se vinculado) | Enxuto demais para a IA proposta |
| Onboarding | seed `DIRECTOR` em `prisma/seeds/onboarding-guides.ts` | Descreve painel único |

### 1.2 O que o painel atual entrega

- Filtros: ciclo atual / relatório geral / outro ciclo (aplicados de forma única a quase tudo).
- Alertas textuais (`insights`) misturados com KPIs acadêmicos, gráficos, rankings e resumo administrativo/financeiro.
- Frequência: sessões já ocorridas (`getEnrollmentAttendanceSummaries`).
- “Evasão”: streak ≥ **4** faltas consecutivas sem justificativa (definição própria do dashboard).
- Rankings de professores/alunos (gamificação) como bloco de destaque.
- Links para Gerência **removidos**; números administrativos ainda no mesmo scroll.

### 1.3 Auditoria crítica — faltas consecutivas

| Conceito | Constante / regra | Valor no código | Onde |
|----------|-------------------|-----------------|------|
| Suspensão automática | `CONSECUTIVE_UNJUSTIFIED_ABSENCE_LIMIT` | **3** | `enrollment-attendance-streak.ts`, `enrollment-attendance-suspension.ts`, UI professor, e-mails |
| Cancelamento automático | `CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT` | **4** | Mesmos arquivos + `AttendanceGrid` |
| KPI “Evasão” do Diretor | usa o limite de **cancelamento (4)** | **4+** | `director-dashboard-data.ts` |
| IGH vs INAC | mesma codebase / mesmas constantes | Sem divergência de regra no código | Deploy compartilha lógica |

**Problema conceitual:** o KPI chama de “evasão” um sinal comportamental (streak ≥ 4), misturando risco, suspensão e cancelamento. A UI do aluno fala em “três faltas” para suspensão. O planejamento v2 **separa** risco de evasão, suspensão e evasão confirmada.

### 1.4 Achados estruturais (resumo da auditoria)

| Tema | Achado |
|------|--------|
| Motivo de saída da matrícula | **Ausente** (sem campo; só `AuditLog` pontual) |
| Histórico de status de matrícula | **Parcial** (`AuditLog`, sem ledger dedicado) |
| Transferência acadêmica | Move `classGroupId` in-place; **não** é status; `TRANSFERENCIA` no schema é método de pagamento |
| Cancelamento antes da 1ª aula | **Derivável** com heurística; sem flag |
| Primeira presença | **Derivável** via `SessionAttendance`; campo dedicado só em referral |
| Waitlist / oferta de vaga | Models **existem**; **não** usados no dashboard Diretor |
| Pré-matrícula | `isPreEnrollment` / `enrollmentConfirmedAt` existem; painel **não** separa |
| Provas / progresso / exercícios | Models existem; painel só usa tops de gamificação |
| Metas | `AnnualGoal` = ano + computadores + pessoas; **sem** vínculo projeto/polo/curso; pessoas sem realizado |
| “Convênios” na Gerência | `PaymentAgreement` = **kanban de pagamento de colaboradores**, não convênio de projeto |
| Financeiro | Lançamentos + categorias + natureza + polo + pago/vencimento; **sem** orçamento, centro de custo, fonte no lançamento, previsão, conciliação |
| Equipamentos | Catálogo + estoque + movimentos de quantidade; **sem** histórico de status unitário |
| Egressos | Feedback/campanhas **não** são CRM de egressos |
| Crons / backup | Executam; **sem** histórico consultável no banco |
| Pasta `docs/` | Existe; sem ADR formal — este plano cria `docs/diretor/` |

---

## 2. Problemas atuais do dashboard (produto + técnica)

1. **Monólito de decisão:** um único scroll mistura prioridade, acadêmico, território, financeiro, almoxarifado e rankings — sobrecarrega a Direção e impede foco.
2. **Filtro único de ciclo** aplicado a domínios incompatíveis (folha/finanças não deveriam herdar ciclo acadêmico).
3. **Semântica incorreta ou frágil:** “evasão” = streak 4; “caixa” / saldo do mês a partir de lançamentos sem base de disponibilidade/caixa real.
4. **Rankings como evidência executiva** (gamificação) sem pergunta de decisão institucional.
5. **Lacunas de funil e demanda** (pré-matrícula, waitlist, aceite de vaga) existem no sistema e não aparecem.
6. **Um payload / uma API** força carregar todos os domínios mesmo quando o usuário só precisa de um recorte.
7. **Alertas sem ciclo de vida** (sem persistência, responsável, prazo, situação da providência).
8. **Sem página de relatórios/snapshots** — números “de hoje” não viram documento histórico imutável.

---

## 3. Decisões de produto (já aprovadas + formalizadas aqui)

1. Área executiva **multipágina**; Visão Geral é **porta de entrada**, não dump.
2. Cada indicador tem **página temática principal**; a Visão Geral só resume e linka.
3. Diretor permanece **somente leitura** (exportar relatório = leitura).
4. Drilldowns **dentro** de `/diretor/*`; **não** abrir Gerência operacional.
5. Filtros **por domínio** (ciclo ≠ competência financeira).
6. Sem nota geral única que esconda problemas.
7. Dado indisponível ≠ zero; rotular “indisponível / não calculável”.
8. Não chamar movimentação de lançamentos de caixa/resultado/disponibilidade sem base contábil.
9. Rankings de alunos/professores **não** são indicadores prioritários.
10. Cursos são gratuitos — **não** há mensalidade/inadimplência de aluno pagante.

---

## 4. Arquitetura de informação

### 4.1 Rotas (App Router sob `(protected)`)

```text
/diretor                      → Visão Geral (home do perfil)
/diretor/prioridades
/diretor/academico
/diretor/oferta-territorios
/diretor/impacto-social
/diretor/financeiro
/diretor/projetos-convenios
/diretor/administrativo
/diretor/relatorios
/diretor/guia
```

**Adaptação recomendada:** ao autenticar como `DIRECTOR`, redirecionar `/dashboard` → `/diretor` (mantém compatibilidade com links antigos). Master pode inspecionar via API (como hoje) e, opcionalmente, UI de preview.

### 4.2 Menu

**Direção:** Visão Geral · Prioridades  
**Desempenho:** Acadêmico · Oferta e Territórios · Impacto Social  
**Gestão institucional:** Financeiro · Projetos e Convênios · Administrativo  
**Documentos:** Relatórios · Guia do Diretor

### 4.3 Páginas — responsabilidade e perguntas

| Página | Pergunta central | Conteúdo máximo na entrada |
|--------|------------------|----------------------------|
| Visão Geral | Como está a instituição e onde concentrar atenção? | ≤6 KPIs, ≤5 alertas críticos, variações, prazos, síntese, qualidade dos dados |
| Prioridades | O que exige decisão ou acompanhamento? | Lista completa de alertas + filtros + timeline |
| Acadêmico | Entram, frequentam, aprendem e concluem? | Funil, frequência, risco/evasão, conclusão, aprendizagem |
| Oferta e Territórios | Onde ampliar, reorganizar ou rever oferta? | Demanda × ocupação × conclusão por polo/curso |
| Impacto Social | Quem é beneficiado e quais resultados sociais? | Únicos, recorrentes, metas, doações/equipamentos (produto) |
| Financeiro | Recursos suficientes e uso sustentável? | Movimentação nomeada corretamente; sem inventar caixa |
| Projetos e Convênios | Compromissos no prazo e nos recursos? | Portfólio + detalhe (com honestidade sobre o que o schema permite) |
| Administrativo | Pessoas, docs, materiais e continuidade? | RH, estoque, equipamentos, comunicação crítica |
| Relatórios | Documentos formais e exports | Catálogo + geração/snapshot |
| Guia | Como interpretar | Catálogo de indicadores como fonte única |

Detalhamento de endpoints/componentes: ver `arquitetura-paginas-e-apis.md`.  
Definições e fórmulas: ver `catalogo-indicadores.md`.  
Viabilidade por indicador: ver `matriz-cobertura-dados.md`.

---

## 5. Roadmap

### Fase 0 — Auditoria e correções conceituais

- Concluída com documentos em `docs/diretor/` e decisões §0 aprovadas.

### Fase 1A — Fundação (autorizada / em curso)

Ver §0. Shell `/diretor`, catálogo, sessões canônicas, overview/prioridades/acadêmico/oferta/guia, testes, medição vs monolito, fallback antigo.

### Fase 1B — Completar Fase 1 (após 1A)

Financeiro, administrativo, impacto social, projetos (com disclaimer), relatórios sob demanda, guia enriquecido; ainda sem migrations novas.

### Fase 1 — Separação de páginas com dados existentes (visão completa = 1A+1B)

- Nova navegação e rotas `/diretor/*`.
- Decompor `director-dashboard-data.ts` e `GET /api/diretor/dashboard` em APIs por domínio.
- Visão Geral enxuta; Prioridades (alertas derivados, ainda sem persistência completa); Acadêmico; Oferta/Territórios; Impacto (parcial); Financeiro (movimentação honestamente nomeada); Administrativo (parcial); Projetos (transparência sobre `AnnualGoal` + doações/visitas — **não** fingir convênio de projeto); Relatórios sob demanda (sem snapshot ainda); Guia gerado do catálogo.
- Evitar migrations salvo correção indispensável aprovada.
- **Aceite:** cada página carrega só seu domínio; filtros independentes; Visão Geral ≤6 KPIs / ≤5 alertas; Diretor sem acesso Gerência; zero ≠ indisponível.

### Fase 2 — Histórico e gestão por resultados

- Histórico de status de matrícula e/ou motivo estruturado de saída.
- Intervenções contra evasão (registro).
- Ampliar metas além de `AnnualGoal` anual genérico (vínculos projeto/polo/período) **ou** novo model se `AnnualGoal` for insuficiente.
- Histórico de status de equipamento (se necessário ao fluxo real).
- Snapshots de indicadores / relatório mensal imutável.
- **Aceite:** retenção/coorte e evasão confirmada com denominadores defensáveis; relatórios com data de referência congelada.

### Fase 3 — Inteligência financeira

- Orçamento, fontes, livre/vinculado, centro de custo, rateio, previsão, meses de reserva, custo por resultado.
- **Aceite:** indicadores financeiros avançados só aparecem quando campos existirem; nomes contábeis corretos.

### Fase 4 — Resultados sociais

- Diagnóstico × avaliação final; acompanhamento 30/90/180 dias; emprego/renda/continuidade; satisfação parceiros/empregadores.
- **Aceite:** coleta definida (responsável, instrumento, LGPD); sem causalidade declarada sem método.

### Fase 5 — Alertas preditivos

- Somente com histórico suficiente e validação local.
- Não rotular regras simples como IA.
- **Aceite:** modelos documentados, thresholds configuráveis, revisão humana.

---

## 6. Critérios de aceite do planejamento (checklist)

- [x] Indicadores mapeados a páginas temáticas (`matriz-cobertura-dados.md`, `catalogo-indicadores.md`)
- [x] Filtros por domínio (`arquitetura-paginas-e-apis.md`)
- [x] Risco ≠ evasão; matrícula ≠ beneficiário; ocupação inicial ≠ atual
- [x] Movimentação ≠ caixa ≠ orçamento ≠ resultado
- [x] Reuso de models antes de novos
- [x] Lacunas classificadas
- [x] Coleta para dados novos (quando aplicável)
- [x] Fórmulas com denominador
- [x] Gráficos ligados a perguntas
- [x] Visão Geral enxuta
- [x] Somente leitura
- [x] APIs por domínio
- [x] Performance, LGPD, testes, snapshots
- [x] **Nenhuma implementação nesta etapa**

---

## 7. Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Nomear “caixa/resultado” com `FinancialEntry` | Decisão errada da Direção | Fase 1: rótulos “Movimentação de lançamentos”; Fase 3: modelos adequados |
| Confundir `PaymentAgreement` com convênio de projeto | Página Projetos vazia ou enganosa | Explicitar no Guia; Fase 2 novo model se necessário |
| KPI evasão atual (streak 4) vs necessidade de “evasão confirmada” | Quebra de série histórica | Versionar fórmulas; dual-run no Guia |
| Critério de sessão divergente (LIBERADA vs não cancelada) | Números inconsistentes entre páginas | Decisão única na Fase 0/1 |
| Snapshots sem política de retenção | Disco/LGPD | Definir retenção antes da Fase 2 |
| Grupos pequenos em drilldown | Reidentificação | Agregar / ocultar n &lt; limiar |
| Carga de queries se páginas reimplementarem métricas | Lentidão / divergência | Catálogo + libs compartilhadas |
| Portal colaborador no menu do Diretor | Ruído | Manter só se houver vínculo; fora do menu “Direção” |

---

## 8. Dependências

- Aprovação deste pacote `docs/diretor/*`.
- Decisões de glossário (seção 10).
- Seed/atualização do guia após Fase 1.
- Possível redirect `/dashboard` → `/diretor` para role DIRECTOR.
- Para IGH e INAC: mesma lógica de app; segregação continua por URL/credencial de banco (já existente).

---

## 9. Critérios de aceite da Fase 1 (implementação futura)

1. Menu Direção/Desempenho/Gestão/Documentos conforme §4.2.
2. Visão Geral sem tabelas longas, rankings ou lançamentos.
3. Cada card/alerta linka para página temática com query de filtros.
4. Financeiro filtrado por competência/`entryDate`/`paidAt`, **não** por ciclo acadêmico.
5. Acadêmico/Oferta filtrados por ciclo.
6. APIs separadas; falha em um domínio não derruba os outros na Visão Geral (partial success).
7. Tooltips com fórmula/denominador nos KPIs principais.
8. Testes de autorização: Diretor não muta; não acessa APIs Gerência.
9. Performance: TTFB da Visão Geral menor que o payload monolítico atual (medir antes/depois).

---

## 10. Decisões que ainda dependem de aprovação

1. **Home do Diretor:** `/diretor` com redirect de `/dashboard`?
2. **Alinhar “evasão” do painel atual:** renomear imediatamente para “risco/cancelamento por faltas” na Fase 1, ou manter dual-label até Fase 2?
3. **Critério de sessão** para frequência e streak: unificar em “sessões elegíveis ocorridas” — quais status entram?
4. **Denominador de conclusão:** quem iniciou (1ª presença) vs todos confirmados?
5. **Justificativa no denominador da frequência:** manter presença = P / sessões ocorridas (justificada conta como não-presente no numerador, mas permanece no denom) — confirmar regra institucional.
6. **Página Projetos e Convênios na Fase 1:** conteúdo mínimo (metas anuais + doações + visitas) com disclaimer, ou adiar página até model de convênio de projeto?
7. **Persistência de alertas/providências:** só derivados na Fase 1, ou já model `DirectorAlert`?
8. **Snapshots de relatório:** sob demanda apenas (Fase 1) vs armazenamento obrigatório do Relatório Executivo Mensal (Fase 2)?
9. **Limiar LGPD** para ocultar grupos pequenos (sugestão: n &lt; 5).
10. **Master na UI `/diretor`:** preview completo ou só APIs?

---

## Limitações e regras da Fase 1A (validação)

### Chamada incompleta
Oportunidade elegível (`LIBERADA`, ≤ `dataAsOf`, após entrada) **sem** `SessionAttendance`:
- entra no **denominador** das taxas de presença/justificada/não justificada;
- **não** é convertida em falta;
- eleva `quality` para `partial`;
- `callCompletenessRate = marcadas ÷ oportunidades`;
- no streak: sessão sem lançamento é ignorada (não incrementa nem zera).

### Transferência acadêmica
Não há histórico tipado de transferência. Cancelamentos após o início com presença aparecem como **“Cancelamentos após o início — motivo não tipado”** (qualidade parcial). Não usar o rótulo “evasão confirmada”.

### Estoque vs série histórica
Ocupação atual, suspensos, waitlist e risco crítico são **estoque/estado atual** do recorte, não séries temporais congeladas. Sem snapshot, “histórico indisponível” quando a comparação não for reconstruível.

### Versão das fórmulas
`formulaVersion = 1A.0.0` (`FORMULA_VERSION_1A`).

### Métricas ainda indisponíveis na 1A
Financeiro completo, administrativo, impacto social completo, projetos/convênios institucionais, ocupação inicial na Visão Geral, tempo para preenchimento, evasão confirmada, snapshots, alertas persistentes.

### Fase 1B (implementada)
Loaders independentes; financeiro (entryDate vs paidAt); administrativo; impacto (alcance); projetos informativo; relatórios JSON/CSV; overview com falha parcial. Sem redirect definitivo de `/dashboard`.
