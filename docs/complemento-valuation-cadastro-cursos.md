# Complemento para Valuation — CadastroCursos (IGH)

**Documento:** Metodologia financeira e estimativas em reais  
**Uso:** Leia em conjunto com `levantamento-recursos-cadastro-cursos.md` (inventário funcional)  
**Data:** 03/07/2026  
**Moeda:** BRL (R$)

> Este documento **não repete** o inventário de telas, APIs, models ou stack. Ele traduz o escopo já documentado em **horas, complexidade, custos, riscos e fórmulas** para chegar a um valor em reais.

---

## 1. Objetivo e como usar os dois documentos

| Documento | Responde |
|-----------|----------|
| `levantamento-recursos-cadastro-cursos.md` | **O que** o sistema faz (escopo, módulos, integrações) |
| `complemento-valuation-cadastro-cursos.md` (este) | **Quanto** isso vale em R$ e **como** calcular |

**Fluxo recomendado para fechar um número:**

1. Validar o escopo do inventário com stakeholders (IGH).
2. Ajustar horas deste documento se algum módulo estiver incompleto ou superdimensionado.
3. Escolher faixa de valor/hora conforme perfil da equipe (freelancer, agência, equipe interna).
4. Calcular **valor de reposição** (custo de refazer).
5. Aplicar descontos/prêmios para **valor de mercado** ou **preço ao cliente**.
6. Somar **OPEX mensal** se a proposta incluir operação.

---

## 2. Três conceitos de “valor” (não confundir)

| Conceito | Definição | Quando usar |
|----------|-----------|-------------|
| **Valor de reposição** | Quanto custaria desenvolver um sistema equivalente hoje, do zero, com escopo similar | Seguro, due diligence, argumento de investimento |
| **Valor de mercado (ativo)** | Quanto um terceiro pagaria pelo código + operação + base de usuários + marca | Venda do software, fusão, licenciamento |
| **Preço comercial ao cliente** | Quanto cobrar por implantação, licença, customização e suporte | Proposta comercial, contrato de prestação |

**Importante:** o mesmo sistema pode valer **R$ 400 mil** em reposição e ser **vendido por R$ 150 mil** (sem base de clientes) ou **licenciado por R$ 8 mil/mês** (com suporte). Os três números coexistem.

---

## 3. Premissas adotadas nesta estimativa

| Premissa | Valor assumido | Observação |
|----------|----------------|------------|
| Escopo | Equivalente ao inventário funcional (jul/2026) | Inclui evoluções recentes (fórum rich text, frequência em grade, multi-professor, suspensão por faltas) |
| Equipe de referência | 1–2 devs full-stack sênior + apoio pontual design/QA | Desenvolvimento iterativo com IA e retrabalho |
| Qualidade de testes | Baixa cobertura automatizada | Ajuste de +10% a +20% no esforço para hardening |
| Documentação técnica | Parcial (README desatualizado) | +5% em manutenção futura |
| Ambiente | Single-tenant (IGH), Vercel + Postgres | Não inclui multi-tenant SaaS |
| Localização | Mercado brasileiro | Valores/hora em BRL |

---

## 4. Matriz de complexidade por módulo

Escala: **Baixa** (CRUD simples) · **Média** (regras moderadas) · **Alta** (regras de negócio, integrações, UX densa) · **Muito alta** (subproduto completo)

| # | Módulo / domínio | Complexidade | Justificativa técnica (resumo) |
|---|------------------|--------------|--------------------------------|
| A1 | Autenticação, sessão, RBAC, multi-perfil | Alta | JWT, cookies, 5 papéis, recuperação por CPF/responsável, setup Master |
| A2 | Legal (termos versionados + aceite) | Média | Versionamento, publicação, bloqueio de fluxo |
| A3 | Onboarding + tutoriais in-app | Média | Por perfil, métricas de visita |
| B1 | Site institucional (front público) | Média | Múltiplas páginas, SEO, responsivo |
| B2 | CMS do site (`/admin/site/*`) | Alta | 17+ áreas editáveis, rich text, uploads, aprovação Master |
| B3 | Inscrição pública + confirmação | Média | Token, e-mail, termos |
| C1 | CRUD cursos / módulos / aulas | Alta | Rich text TipTap, vídeo, PDF, anexos, exercícios |
| C2 | Turmas + geração de sessões | Muito alta | Carga horária, feriados, dias da semana, status automático, multi-professor |
| C3 | Matrículas + confirmação | Alta | E-mail, senha temporária, status, certificado implícito no fluxo |
| C4 | Feriados + recálculo de cronograma | Alta | Impacto em todas as turmas, notificação |
| C5 | Frequência (professor + admin) | Alta | Grade P/F/J, suspensão 3 faltas, export PDF |
| C6 | Provas formais | Muito alta | Banco de questões, tentativas, cronômetro, export, replicação |
| D1 | Portal aluno — player de aula | Muito alta | Vídeo, progresso, paginação H1, notas, trechos, exercícios |
| D2 | Portal aluno — provas | Alta | Integrado a C6 |
| D3 | Portal aluno — dashboard / evolução / favoritos | Média | Agregações, UX |
| D4 | Liberação de aulas por cronograma | Alta | Sessões LIBERADA, turma encerrada, matrícula suspensa |
| E1 | Fórum por aula (rich text + fotos + galeria) | Alta | Upload Apimages, moderação implícita, visão curso inteiro |
| E2 | Comunidade IGH + moderação | Média | Fila admin, tipos de tópico |
| E3 | Suporte + coordenação | Média | Tickets, mensagens, anexos, badges |
| F1 | E-mail transacional + outbox | Alta | Resend, fila por cota, templates |
| F2 | Campanhas e-mail em massa | Muito alta | Segmentação, webhook, métricas, reenvio |
| F3 | Campanhas SMS | Alta | Similar a F2, provedor SMS |
| F4 | Campanhas marketing / pesquisas | Média | Modal aluno, convidados, curtidas |
| G1 | Notificações in-app | Média | Múltiplos tipos, deduplicação |
| G2 | Gamificação professor + ranking alunos | Média | Regras de pontuação, exports |
| H1 | Master (backup, logs, aprovações) | Alta | Operações sensíveis |
| H2 | Exports (PDF, XLSX, planos de aula) | Média | pdf-lib, xlsx |
| I1 | Infra, deploy, crons | Média | Vercel, 3 crons, migrations |
| I2 | Qualidade / testes automatizados | Baixa (entregue) | Débito: cobertura mínima |

---

## 5. Estimativa de esforço (horas de desenvolvimento)

Horas **indicativas** para construção do escopo atual, incluindo backend, frontend, integrações e ajustes iterativos. Não incluem gestão de produto extensa nem marketing.

| Módulo | Dev (h) | Design/UX (h) | QA manual (h) | PM/reuniões (h) | **Subtotal (h)** |
|--------|---------|---------------|---------------|-----------------|------------------|
| A — Conta, auth, legal, onboarding | 180 | 40 | 50 | 40 | **310** |
| B — Site + CMS | 320 | 80 | 70 | 50 | **520** |
| C — Gestão acadêmica (cursos, turmas, matrículas, feriados, frequência, provas admin) | 520 | 60 | 120 | 80 | **780** |
| D — Portal do aluno (LMS completo) | 480 | 100 | 100 | 60 | **740** |
| E — Fórum, comunidade, suporte, coordenação | 220 | 40 | 60 | 30 | **350** |
| F — Comunicação (e-mail, SMS, marketing) | 380 | 30 | 80 | 50 | **540** |
| G — Notificações, gamificação, rankings | 120 | 20 | 30 | 20 | **190** |
| H — Master, exports, auditoria | 100 | 10 | 25 | 20 | **155** |
| I — Infra, migrations, crons, hardening | 120 | — | 40 | 20 | **180** |
| **Contingência técnica (15%)** | — | — | — | — | **538** |
| **TOTAL ESTIMADO** | | | | | **≈ 4.303 h** |

### Faixa de sensibilidade

| Cenário | Horas | Comentário |
|---------|-------|------------|
| **Otimista** | 3.200 h | Escopo reduzido, pouco retrabalho, equipe muito experiente no stack |
| **Base (tabela acima)** | 4.300 h | Reflete complexidade real observada no código |
| **Pessimista** | 5.500 h | Inclui refatoração, testes, documentação e features não inventariadas |

---

## 6. Valor de reposição em reais

### 6.1 Faixas de valor/hora (mercado BR, 2026)

| Perfil | R$/h (faixa) | Contexto |
|--------|--------------|----------|
| Dev full-stack pleno | 80 – 120 | Freelancer regional |
| Dev full-stack sênior | 120 – 180 | Especialista Next/Postgres |
| Agência / consultoria | 150 – 250 | Inclui overhead comercial |
| Equipe interna (custo CLT) | 60 – 100 | Custo empresa, não preço de venda |

### 6.2 Cálculo de reposição

```
Valor de reposição = Horas totais × Valor/hora médio ponderado
```

| Cenário horas | × R$ 120/h | × R$ 150/h | × R$ 180/h |
|---------------|------------|------------|------------|
| 3.200 h (otimista) | R$ 384.000 | R$ 480.000 | R$ 576.000 |
| **4.300 h (base)** | **R$ 516.000** | **R$ 645.000** | **R$ 774.000** |
| 5.500 h (pessimista) | R$ 660.000 | R$ 825.000 | R$ 990.000 |

**Faixa de reposição recomendada para negociação:** **R$ 520 mil – R$ 800 mil** (base a pessimista, R$ 120–150/h).

---

## 7. Valor de mercado (ativo software)

O valor de mercado raramente iguala o custo de reposição. Ajustes típicos:

| Fator | Impacto no valor | Situação IGH (avaliar) |
|-------|------------------|------------------------|
| Base de usuários ativos | +20% a +100% | Quantos alunos/professores usam mensalmente? |
| Receita recorrente atrelada | +valor presente do fluxo | Há mensalidade ou só custo interno? |
| Exclusividade do código | +10% a +30% | Código próprio, não é white-label genérico |
| Débito técnico / testes | −10% a −25% | Cobertura de testes muito baixa |
| Documentação desatualizada | −5% a −10% | README ainda descreve MVP 1 |
| Dependência de pessoas-chave | −10% a −20% | Conhecimento tribal no código |
| Marca e domínio IGH | +5% a +15% | Site e identidade acoplados |
| Migrações pendentes em produção | −5% | Risco operacional imediato |

### Fórmula sugerida

```
Valor de mercado ≈ Valor de reposição × Coeficiente de mercado (0,5 a 1,2)
```

| Situação | Coeficiente | Exemplo (base R$ 645 mil) |
|----------|-------------|---------------------------|
| Venda “só código”, sem operação | 0,4 – 0,6 | R$ 260 – 390 mil |
| Licenciamento interno / grupo | 0,7 – 0,9 | R$ 450 – 580 mil |
| Com base ativa + operação estável | 0,9 – 1,2 | R$ 580 – 774 mil |

---

## 8. Preço comercial ao cliente (modelo de proposta)

Estrutura em **três pacotes** para orçamento ao IGH ou a terceiros (prefeituras, parceiros, outras unidades).

### Pacote 1 — Implantação e entrega

| Item | Descrição | Faixa (R$) |
|------|-----------|------------|
| Implantação ambiente | Vercel, Postgres, variáveis, migrations, domínio | 8.000 – 15.000 |
| Migração de dados | Alunos, turmas, conteúdo (se houver legado) | 5.000 – 25.000 |
| Customização visual | Logo, cores, textos institucionais | 10.000 – 30.000 |
| Treinamento | Admin + professores (8–16 h) | 4.000 – 12.000 |
| **Subtotal implantação** | | **27.000 – 82.000** |

### Pacote 2 — Licença de uso (anual)

| Modelo | Descrição | Faixa (R$/ano) |
|--------|-----------|----------------|
| Licença institucional | Uso ilimitado interno IGH | 48.000 – 120.000 |
| Licença por unidade | Por cidade/filial adicional | 12.000 – 36.000/unidade |

*Referência: 8% a 18% do valor de reposição/ano para software vertical customizado.*

### Pacote 3 — Suporte e evolução (mensal)

| Nível | SLA | Horas/mês | Faixa (R$/mês) |
|-------|-----|-----------|----------------|
| **Básico** | Correções críticas, 48h úteis | 4 h | 2.000 – 4.000 |
| **Padrão** | Correções + pequenas melhorias, 24h úteis | 12 h | 6.000 – 12.000 |
| **Premium** | Evolução contínua + plantão em período letivo | 24–40 h | 14.000 – 35.000 |

---

## 9. Custos operacionais mensais (OPEX)

Valores para **planejamento financeiro** (não são receita). Ajustar conforme volume real.

| Item | Faixa mensal (R$) | Observação |
|------|-------------------|------------|
| Vercel (hosting Next.js) | 0 – 500 | Hobby a Pro conforme tráfego |
| PostgreSQL (Neon/Vercel) | 0 – 800 | Escala com storage e conexões |
| Resend (e-mail) | 0 – 400 | Free tier até ~3k/dia; campanhas aumentam |
| Apimages / Cloudinary (mídia) | 100 – 600 | Depende de uploads no fórum e CMS |
| SMS (campanhas) | variável | ~R$ 0,15–0,40/SMS + plataforma |
| Domínio + DNS | 15 – 50 | |
| Monitoramento / backups extras | 0 – 200 | |
| **OPEX infra típico (sem SMS em massa)** | **150 – 2.000** | |
| **OPEX + suporte dev (Pacote Padrão)** | **6.150 – 14.000** | Infra + 12 h suporte |

---

## 10. Avaliação de qualidade e débito técnico

Impacto direto no valuation — **não duplica inventário**, apenas classifica risco.

| Aspecto | Nota (1–5) | Impacto financeiro |
|---------|------------|-------------------|
| Arquitetura geral (Next + Prisma monólito) | 4 | Positivo: manutenível |
| Segurança (auth, RBAC, validação Zod) | 4 | Positivo |
| Cobertura de testes automatizados | 1 | Negativo: −10% a −20% no valor de mercado |
| Documentação técnica | 2 | Negativo: onboarding de novo dev mais caro |
| Consistência UI/UX | 4 | Positivo: Tailwind, componentes reutilizados |
| Regras de negócio acopladas | 3 | Neutro: poderoso, mas exige conhecimento de domínio |
| Migrations / schema | 4 | Positivo: Prisma maduro; atenção a pendentes em prod |
| Performance / escala | 3 | Neutro: adequado para IGH; revisar se >10k usuários simultâneos |

**Débito técnico estimado para “nível enterprise”:** 400–800 h adicionais (testes E2E, documentação, observabilidade, CI completo).

---

## 11. Riscos que afetam o preço

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Migrations não aplicadas em produção | Média | Alto | `prisma migrate deploy` + checklist |
| Perda de dados ao editar turma (sessões) | Baixa (corrigido) | Alto | Validar em staging |
| Cota Resend esgotada | Média | Médio | EmailOutbox + monitoramento |
| Dependência de Apimages | Média | Médio | Fallback Cloudinary documentado |
| Ausência de testes em releases | Alta | Alto | Suite mínima em rotas críticas |
| README desatualizado | Alta | Baixo | Atualizar documentação |
| Concentração de conhecimento em 1 dev | Média | Alto | Este par de documentos + handover |

---

## 12. Comparáveis de mercado (referência, não preço final)

| Alternativa | Custo típico | O que o CadastroCursos tem a mais |
|-------------|--------------|-----------------------------------|
| Moodle auto-hospedado + tema | R$ 50–150 mil implantação + manutenção | CMS integrado, identidade IGH, regras BR (CPF, feriados locais) |
| SaaS LMS genérico | R$ 15–80/aluno/ano | Customização total, dados próprios, site unificado |
| Desenvolvimento do zero (terceiro) | R$ 500 mil – 1 M+ | Este ativo já existe e está em produção |

O CadastroCursos se posiciona como **plataforma vertical customizada** — valor superior a LMS genérico, inferior a rewrite completo sem aproveitar o existente.

---

## 13. Planilha-resumo para fechar o valor (preencher)

Use esta tabela na reunião de valuation:

| Campo | Valor (preencher) |
|-------|-------------------|
| Horas totais adotadas | _____ h (sugestão: 4.300) |
| Valor/hora adotado | R$ _____ (sugestão: 150) |
| **Valor de reposição** | **R$ _____** |
| Coeficiente de mercado (0,5–1,2) | _____ |
| **Valor de mercado estimado** | **R$ _____** |
| Alunos ativos mensais | _____ |
| Receita mensal atrelada ao sistema | R$ _____ |
| OPEX mensal (infra) | R$ _____ |
| Suporte mensal desejado | R$ _____ |
| **Preço de licença anual proposto** | **R$ _____** |
| **Preço de implantação (se novo cliente)** | **R$ _____** |

### Exemplo preenchido (cenário base)

| Campo | Valor |
|-------|-------|
| Horas totais | 4.300 h |
| Valor/hora | R$ 150 |
| **Valor de reposição** | **R$ 645.000** |
| Coeficiente de mercado | 0,75 (ativo interno, débito técnico) |
| **Valor de mercado estimado** | **≈ R$ 484.000** |
| Licença anual sugerida | R$ 72.000 (≈ 12% reposição) |
| Implantação nova unidade | R$ 45.000 |
| OPEX + suporte padrão | R$ 9.000/mês |

---

## 14. Itens fora do escopo (não incluir no valor sem aditivo)

- Aplicativo mobile nativo (iOS/Android)
- Multi-tenant SaaS para terceiros
- Integração com ERP financeiro / NF-e
- Videoconferência embutida (Zoom/Meet)
- BI avançado / data warehouse
- Certificados digitais com ICP-Brasil
- LGPD: DPO, RIPD, anonimização automatizada (há base, não pacote completo)

Cobrar à parte se solicitado.

---

## 15. Próximos passos recomendados

1. **Validar horas** com quem desenvolveu (ajuste fino de ±20%).
2. **Definir objetivo da valuation:** venda, licenciamento, seguro, investimento ou prestação de contas.
3. **Coletar métricas de uso:** MAU (usuários ativos/mês), turmas ativas, volume de e-mails/SMS.
4. **Aplicar migrations pendentes** antes de due diligence externa.
5. **Opcional:** auditoria de segurança pontual (OWASP top 10) — orçar R$ 8–25 mil separado.

---

## 16. Declaração de limitação

Esta estimativa é **indicativa**, baseada em análise estática do código e inventário funcional. Não constitui avaliação formal de empresa (valuation jurídico/contábil). Para transações societárias, recomenda-se avaliador independente.

---

*Documento complementar ao inventário funcional. Versão 1.0 — jul/2026.*
