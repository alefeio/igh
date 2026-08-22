# Arquitetura de páginas e APIs — Diretor v2

**Status:** decisões aprovadas; Fase 1A em implementação  
**Convenção de rotas:** `src/app/(protected)/diretor/...` → `/diretor/...`

### Decisões de arquitetura (21/08/2026)

- Home definitiva `/diretor`; redirect `/dashboard`→`/diretor` **só** para `DIRECTOR` e **após** validação (1A: sem redirect definitivo; fallback monolítico ativo).
- Master: leitura completa + banner “Visualização do perfil Diretor” (sem impersonação).
- Catálogo tipado no código; métricas compartilhadas; APIs por domínio.
- Alertas derivados (sem persistência); LGPD `MIN_AGGREGATE_GROUP_SIZE=5`.
- Sessões elegíveis canônicas em helper único (`LIBERADA` + `dataAsOf`).

### Fase 1A — escopo de rotas/APIs

Implementar: `overview`, `priorities`, `academic`, `offer-territories`, `guide` (+ UI).  
Adiar: financial, projects, administrative, social-impact completos, reports generate.

---

## 1. Árvore de rotas (proposta)

```text
src/app/(protected)/diretor/
  layout.tsx                 # shell do menu Direção + filtros de contexto leves
  page.tsx                   # Visão Geral
  prioridades/page.tsx
  academico/page.tsx
  oferta-territorios/page.tsx
  impacto-social/page.tsx
  financeiro/page.tsx
  projetos-convenios/page.tsx
  administrativo/page.tsx
  relatorios/page.tsx
  guia/page.tsx
```

**Compatibilidade:**

- `DIRECTOR` em `/dashboard` → redirect `/diretor`.
- Remover uso de `DirectorDashboard` monolítico após migração (ou adaptar como wrapper temporário só da Visão Geral).

---

## 2. Menu (Sidebar)

Grupo **Direção** (roles: `DIRECTOR`; Master opcional em preview):

| Label | href |
|-------|------|
| Visão Geral | `/diretor` |
| Prioridades | `/diretor/prioridades` |
| Acadêmico | `/diretor/academico` |
| Oferta e Territórios | `/diretor/oferta-territorios` |
| Impacto Social | `/diretor/impacto-social` |
| Financeiro | `/diretor/financeiro` |
| Projetos e Convênios | `/diretor/projetos-convenios` |
| Administrativo | `/diretor/administrativo` |
| Relatórios | `/diretor/relatorios` |
| Guia do Diretor | `/diretor/guia` |

Manter “Como usar o sistema” (`/onboarding`) ou unificar com `/diretor/guia` (decisão pendente).

**Proxy:** incluir matcher `/diretor/:path*`; garantir `DIRECTOR` (e Master se preview) e **continuar bloqueando** `/admin/gerencia` para Diretor.

---

## 3. Responsabilidade por página

| Rota | Responsabilidade | Não deve carregar |
|------|------------------|-------------------|
| `/diretor` | ≤6 KPIs, ≤5 alertas, variações, prazos, qualidade, links | Tabelas longas, rankings, lançamentos, estoque completo |
| `/diretor/prioridades` | Inbox de alertas + filtros + timeline | Execução operacional (botões de mutação) |
| `/diretor/academico` | Funil, frequência, risco/evasão, conclusão, aprendizagem | Financeiro/estoque |
| `/diretor/oferta-territorios` | Demanda, ocupação, polos, heatmap, quadrantes | Folha/contratos |
| `/diretor/impacto-social` | Beneficiários, metas, doações, visitas (produto) | Lançamentos detalhados |
| `/diretor/financeiro` | Movimentação de lançamentos, AP/AR, categorias, folha | Ciclo acadêmico como filtro mestre |
| `/diretor/projetos-convenios` | Metas anuais + visitas + disclaimer; futuro portfólio | PaymentAgreement como “convênio de projeto” |
| `/diretor/administrativo` | Pessoas, contratos, estoque, comunicação crítica | Detalhe técnico de HTTP de provedores |
| `/diretor/relatorios` | Catálogo e geração/export | Mutação de dados-fonte |
| `/diretor/guia` | Glossário/fórmulas a partir do catálogo | Dados operacionais vivos |

---

## 4. Endpoints (separação obrigatória)

Substituir o uso exclusivo de `GET /api/diretor/dashboard`.

```text
GET /api/diretor/overview
GET /api/diretor/priorities
GET /api/diretor/academic
GET /api/diretor/offer-territories
GET /api/diretor/social-impact
GET /api/diretor/financial
GET /api/diretor/projects
GET /api/diretor/administrative
GET /api/diretor/reports                # lista / metadados
POST /api/diretor/reports/generate     # read-only generation (sem mutar domínio operacional)
GET /api/diretor/reports/[id]          # snapshot (Fase 2)
GET /api/diretor/guide                 # catálogo serializado para UI do guia
```

**Autorização:** `requireRole(["DIRECTOR", "MASTER"])` em todas; **nenhum** método que altere Gerência/matrículas.  
`POST .../reports/generate` apenas cria artefato de leitura (arquivo/snapshot), com audit log.

**Métodos bloqueados:** qualquer proxy para `/api/admin/gerencia/*` continua `FORBIDDEN` para Diretor.

### 4.1 Query params por domínio

| API | Params principais |
|-----|-------------------|
| overview | `execPeriod=YYYY-MM` · `cycleId?` (dois eixos separados) |
| priorities | `severity`, `domain`, `status`, `from`, `to`, `owner?` |
| academic | `cycleId`, `courseId?`, `classGroupId?`, `poloId?`, `teacherId?`, `enrollmentStatus?` |
| offer-territories | `cycleId`, `enrollFrom?`, `enrollTo?`, `poloId?`, `courseId?` |
| social-impact | `from`, `to`, `cycleId?`, `poloId?`, `courseId?` |
| financial | `competence=YYYY-MM` **ou** `from`+`to`, `categoryId?`, `poloId?`, `paymentStatus?` |
| projects | `year?`, `from?`, `to?` |
| administrative | `competence?`, `from?`, `to?` |
| reports | `type`, `period`, filtros do domínio |

### 4.2 Preservação de filtros na navegação

Links da Visão Geral usam query string tipada, ex.:

```text
/diretor/academico?cycleId=...&focus=attrition.risk
/diretor/financeiro?competence=2026-08
/diretor/prioridades?domain=academic&severity=critical
```

Utilitário compartilhado: `src/lib/diretor/search-params.ts` (Zod).

---

## 5. Schemas de resposta (Zod — proposta)

Pacote: `src/lib/diretor/schemas/*.ts`

Padrão envelope:

```ts
{
  ok: true,
  data: {
    meta: {
      generatedAt: string,      // ISO
      dataAsOf: string,         // referência dos dados
      filters: object,
      quality: Array<{ domain: string; status: "ok" | "partial" | "unavailable"; note?: string }>,
      cache: { ttlSeconds: number; key: string }
    },
    // payload específico
  }
}
```

Exemplos de blocos:

- **overview:** `kpis: KpiCard[]` (máx 6), `alerts: AlertSummary[]` (máx 5), `deltas[]`, `deadlines[]`, `executiveSummary: string`
- **priorities:** `alerts: DirectorAlert[]`, `facets`, `charts?`
- **academic:** `funnel`, `attendance`, `attrition`, `completion`, `learning`, `series[]`
- **financial:** `movement`, `apAr`, `byCategory[]`, `payroll`, `disclaimers: string[]` (obrigatório)

`KpiCard`: `{ id, label, value, unit, target?, delta?, unavailableReason?, href }`  
`DirectorAlert`: campos da seção 10 do briefing (id, domain, severity, title, fact, value, denominator, period, affectedCount, trend, persistence, impact, suggestedDecision, operationalOwner?, dueAt?, status, source, ruleId, href).

---

## 6. Serviços e decomposição de arquivos

### 6.1 Estado atual a decompor

| Atual | Destino proposto |
|-------|------------------|
| `src/lib/director-dashboard-data.ts` | Quebrar em módulos |
| `src/components/director/DirectorDashboard.tsx` | Páginas + componentes menores |
| `GET /api/diretor/dashboard` | Deprecar após Fase 1 (manter stub redirect ou 410 documentado) |

### 6.2 Estrutura proposta

```text
src/lib/diretor/
  catalog/                 # espelho do catalogo-indicadores.md (fonte de verdade no código)
    definitions.ts
    formulas.ts
  metrics/
    academic.ts
    offer.ts
    social.ts
    financial.ts
    administrative.ts
    projects.ts
  alerts/
    engine.ts              # regras → DirectorAlert[]
    rules/*.ts
  cache.ts                 # unstable_cache por domínio + tags
  quality.ts
  search-params.ts

src/components/diretor/
  shell/DirectorNav.tsx
  shared/KpiGrid.tsx
  shared/AlertList.tsx
  shared/ChartFrame.tsx    # título conclusivo + tooltip fórmula + tabela acessível
  shared/EmptyState.tsx
  shared/DataQualityBadge.tsx
  overview/*
  priorities/*
  academic/*
  offer/*
  social/*
  financial/*
  projects/*
  administrative/*
  reports/*
  guide/*
```

**Regra:** uma métrica = uma função no catálogo/metrics; páginas só orquestram.

---

## 7. Cache, carregamento e performance

| Domínio | TTL sugerido | Invalidação |
|---------|--------------|-------------|
| Academic / Offer | 60–120s | tags por `cycleId` |
| Social | 120–300s | ano/período |
| Financial | 120–300s | competência |
| Administrative | 120s | — |
| Overview | agrega só summaries leves; **não** chama queries pesadas de todas as páginas | parallel `Promise.allSettled` |
| Priorities | 60s | — |
| Reports | sob demanda; snapshots imutáveis | — |

**Regras:**

1. Visão Geral não pré-carrega tabelas detalhadas nem todos os gráficos.
2. Gráficos: dynamic import / lazy no client.
3. Cada página tolera falha parcial de um subbloco.
4. Exibir `generatedAt` / `dataAsOf` por bloco.
5. Avaliar índices: `(Enrollment.classGroupId, status)`, `(ClassSession.classGroupId, sessionDate)`, `(FinancialEntry.deletedAt, entryDate)`, waitlist indexes (já existem parcialmente).
6. Evitar N+1; preferir agregações SQL / groupBy.
7. Tendência longa: não inventar com estado atual — Fase 2 snapshots.

**Baseline a medir na implementação:** tempo e tamanho do payload atual de `/api/diretor/dashboard` vs `/api/diretor/overview`.

---

## 8. Alertas (serviço central, apresentação contextual)

```text
alerts/engine.ts
  → input: resultados de metrics + regras
  → output: DirectorAlert[]
```

- Visão Geral: top 5 `severity=critical` (ou critical+high).
- Prioridades: lista completa + filtros.
- Páginas temáticas: `domain` filtrado.

Fase 1: efêmeros (recalculados).  
Fase 2 (opcional): persistir acknowledgements / providências sem permitir ao Diretor “fechar” mutando a operação-fonte.

---

## 9. Relatórios e snapshots

| Modo | Fase | Descrição |
|------|------|-----------|
| Geração sob demanda | 1 | PDF/Excel a partir dos mesmos metrics; sem persistência obrigatória |
| Snapshot imutável | 2 | `DirectorReport` / `IndicatorSnapshot`: payload JSON, filtros, `formulaVersion`, `dataAsOf`, `generatedByUserId`, tipo, retenção |

Relatórios candidatos: Executivo Mensal; Acadêmico do Ciclo; Oferta/Ocupação; Impacto; Financeiro (lançamentos); Projeto (quando existir); Beneficiários; Equipamentos/Doações; Administrativo; Alertas.

Export = leitura; registrar em `AuditLog`.

---

## 10. Permissões e segurança

| Controle | Como |
|----------|------|
| Role gate | `requireRole(["DIRECTOR","MASTER"])` |
| Mutação Gerência | Continuar `hasAdminManagementAccess` sem Diretor |
| Proxy | Bloquear `/admin/gerencia` se role DIRECTOR (já existe) |
| Overlays | Diretor base não ganha isAdminManager via JWT |
| IGH/INAC | Mesma app; DB separado por env — sem cross-read |
| Exports | Auth + audit + agregação |
| LGPD | Agregar; ocultar n &lt; limiar; sem CPF na API analítica |
| Rankings gamificação | Fora da Visão Geral; no máximo seção opcional não prioritária |

Testes de API: Diretor GET ok; POST/PATCH/DELETE gerência 403; academic filters; financial sem cycle obrigatório.

---

## 11. Design system do dashboard

- Tokens já do painel (`--igh-primary`, cards).
- Máx. 6 KPIs / 5 alertas na home.
- Título do gráfico = conclusão (“Ocupação caiu nos polos X”), não só “Gráfico 1”.
- Tooltip: fórmula + denominador + período.
- Cor + texto/ícone (não só cor).
- Tabela acessível sob cada gráfico.
- Sem gauges, pizza excessiva, 3D, eixos enganosos.
- Priorizar: linha, barra, bullet (meta), waterfall (financeiro Fase 3), heatmap, dispersão (portfólio), funil, retenção.

---

## 12. Possíveis estruturas novas (avaliar — não implementar agora)

| Proposta | Problema | Alternativa existente | Por que pode não bastar |
|----------|----------|----------------------|-------------------------|
| `EnrollmentStatusHistory` | Sem série de status | `AuditLog` | Diff esparso, difícil query |
| `EnrollmentExitReason` | Motivo de saída | — | Campo inexistente |
| `AttritionIntervention` | Ações contra evasão | CoordinatorReport? | Sem vínculo analítico |
| `InstitutionalProject` / `GrantAgreement` | Convênio de projeto | `AnnualGoal`, `PaymentAgreement` | PaymentAgreement é RH; AnnualGoal é anual genérico |
| `Budget` / `BudgetLine` | Orçamento | — | Ausente |
| `FundingSource` + FK em FinancialEntry | Fonte no lançamento | FundingChannel na folha | Não cobre razão geral |
| `CostCenter` | Rateio | poloId parcial | Polo ≠ CC |
| `CashForecastItem` | Previsão | EM_ABERTO | Não é forecast |
| `EquipmentUnitStatusHistory` | Pipeline equipamentos | InventoryMovement | Movimento ≠ status |
| `EgressFollowUp` | 30/90/180 | MarketingCampaign | Não é CRM egressos |
| `IndicatorSnapshot` / `DirectorReport` | Relatório imutável | — | Necessário para histórico formal |
| `CronRun` / `BackupRun` | Saúde ops | vercel logs | Não consultável no app |
| `DirectorAlertAck` | Providência | — | Opcional Fase 2 |

Para cada um aprovado: migration, backfill, APIs, UI Gerência (escrita) + Diretor (leitura), LGPD, testes — detalhar em PR específico após aprovação.

---

## 13. Dependências entre módulos

```text
catalog/definitions
    ↓
metrics/*  ←→  alerts/rules
    ↓
API handlers (overview agrega summaries leves)
    ↓
UI pages (client charts lazy)
```

Financeiro **não** importa filtros de `Cycle` como obrigatórios.  
Acadêmico **não** importa `FinancialEntry`.

---

## 14. Plano de migração técnica (Fase 1)

1. Criar `src/lib/diretor/catalog` + metrics academic/offer a partir do código atual.
2. Extrair frequência/streak sem mudar regras operacionais.
3. Novas rotas UI + menu.
4. `overview` + `priorities` + `academic` + `offer-territories` primeiro (maior valor / dados prontos).
5. `financial` + `administrative` + `social-impact` + `projects` (com disclaimers).
6. `reports` sob demanda + `guide`.
7. Redirect `/dashboard` → `/diretor` para DIRECTOR.
8. Deprecar payload monolítico.
9. Atualizar seed onboarding / guia.
10. Testes autorização + fórmulas críticas.

**Sem migrations** salvo correção aprovada na Fase 0.

---

## 15. Testes (mapa)

Ver também `plano-dashboard-diretor-v2.md` e catálogo §D.

- Unit: formulas (frequência, ocupação, beneficiário único, streak).
- Integration: APIs auth + filters + partial errors.
- UI: navegação, query preservation, empty/loading/error, a11y charts.
- Finance: paid vs open; deletedAt; disclaimer presente no DOM/API.

---

## 16. Referências

- `docs/diretor/plano-dashboard-diretor-v2.md`
- `docs/diretor/matriz-cobertura-dados.md`
- `docs/diretor/catalogo-indicadores.md`
- Código atual: `src/lib/director-dashboard-data.ts`, `src/lib/staff-access.ts`, `src/proxy.ts`, `prisma/schema.prisma`

---

## 17. Fase 1B — loaders independentes e cadastro futuro

APIs temáticas **não** usam `loadAcademicOfferBundle`. Loaders: `academic.ts`, `offer.ts`, `financial.ts`, `administrative.ts`, `social.ts`, `projects.ts`. A Visão Geral usa `summarize*` + `Promise.allSettled` (falha parcial).

Cache: `cachedDirector` com chave por domínio e filtros. Relatórios: JSON/CSV sob demanda (`csv-export`); PDF/XLSX existem no projeto (`pdf-lib`, `exceljs`) mas **não** são gerados neste endpoint na 1B.

### Estrutura futura (sem migration nesta fase)

`InstitutionalProject` (previsto): nome, vigência, financiador, metas, orçamento, responsáveis, status, prestação de contas.

`GrantAgreement` (previsto): vínculo a projeto, financiador, período, valores acordados — **não** usar `PaymentAgreement` (Kanban de colaboradores).
