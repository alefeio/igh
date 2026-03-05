# Status das alterações: Admin não exclui definitivamente + Fila de aprovação Master

## 1. Admin não pode excluir definitivamente

### ✅ Já implementado

**APIs (DELETE apenas MASTER):**
- **Site:** Formações (`formations/[id]`, `formations/[id]/courses`), Parceiros, Banners, Notícias (posts e categorias), FAQ, Transparência (categorias e documentos), Projetos, Depoimentos, Menu — todos os handlers `DELETE` usam `requireRole("MASTER")`.
- **Restante:** Matrículas, Alunos (exclusão definitiva), Professores, Cursos, Turmas, Usuários (admin), Horários, Feriados — já eram apenas MASTER.

**UI que já esconde Excluir para Admin:**
- **Matrículas:** botões "Editar" e "Excluir" só aparecem quando `isMaster`.
- **Alunos:** "Excluir", "Excluir definitivamente" e "Reativar" só aparecem quando `isMaster`.

### ⚠️ Falta fazer

**UI das páginas do site (admin):**  
Nas telas Configurações, Sobre, Menu, Banners, Projetos, Depoimentos, Parceiros, Notícias, FAQ, Transparência e Formações, o botão **"Excluir"** ainda é exibido para usuário Admin. A API já retorna 403, mas o botão deveria ser exibido **apenas para MASTER** (por exemplo usando `useUser()` e `user.role === "MASTER"`).

---

## 2. Fila de aprovação (alterações do Admin no site)

### ✅ Já implementado

- **Modelo:** `PendingSiteChange` no Prisma (requestedByUserId, entityType, action, entityId, payload, status, reviewedByUserId, reviewedAt).
- **Migration:** `20260306000000_pending_site_change`.
- **Lib:** `src/lib/pending-site-change.ts` — `createPendingSiteChange`, `listPendingSiteChanges`, `getPendingSiteChange`, `rejectPendingSiteChange`, `approvePendingSiteChange` e `applyPendingChange` para todos os tipos de entidade.
- **APIs Master:** `GET /api/master/pending-site-changes`, `POST .../[id]/approve`, `POST .../[id]/reject`.
- **Página:** `/approvacoes` — lista pendentes, botões Aprovar e Rejeitar. Link no menu lateral apenas para MASTER; middleware restringe `/approvacoes` a MASTER.

**Módulos do site que já vão para a fila quando o usuário é ADMIN:**
- **Configurações** — PATCH
- **Sobre** — PATCH
- **Menu** — POST (item), PATCH (ordem), PATCH [id] (item)
- **Banners** — POST, PATCH (ordem), PATCH [id]
- **Projetos** — POST, PATCH (ordem), PATCH [id]

Ou seja: para esses módulos, Admin envia alteração para aprovação; Master aplica direto e pode aprovar/rejeitar na página de aprovações.

### ⚠️ Falta fazer

**Módulos do site que ainda aplicam direto para ADMIN (não usam fila):**
- **Depoimentos** — POST, PATCH (reorder), PATCH [id]
- **Parceiros** — POST, PATCH (reorder), PATCH [id]
- **Notícias (categorias)** — POST, PATCH (reorder), PATCH [id]
- **Notícias (posts)** — POST, PATCH [id]
- **FAQ** — POST, PATCH (reorder), PATCH [id]
- **Transparência (categorias)** — POST, PATCH [id]
- **Transparência (documentos)** — POST, PATCH [id]
- **Formações** — POST, PATCH (reorder), PATCH [id], PUT [id]/courses

Nesses casos, é preciso:
1. Nas rotas, identificar se o usuário é ADMIN ou MASTER (já existe `requireRole(["ADMIN", "MASTER"])`).
2. Se **ADMIN:** em vez de aplicar no banco, chamar `createPendingSiteChange(...)` e retornar mensagem do tipo "Alteração enviada para aprovação do Master."
3. Se **MASTER:** manter o comportamento atual (aplicar direto).
4. Garantir que o `applyPendingChange` já trate os reorders necessários (ex.: `site_testimonial_reorder`, `site_partner_reorder`, etc.), ou adicionar esses casos.

---

## Resumo

| Item | Estado | Observação |
|------|--------|------------|
| APIs DELETE só MASTER | ✅ | Site e demais áreas restritas |
| UI Matrículas/Alunos esconde Excluir para Admin | ✅ | |
| UI páginas do site esconde Excluir para Admin | ❌ | Mostrar Excluir só para MASTER |
| Fila: modelo, APIs, página /approvacoes | ✅ | |
| Fila: Configurações, Sobre, Menu, Banners, Projetos | ✅ | Admin → pendente; Master → direto |
| Fila: Depoimentos, Parceiros, Notícias, FAQ, Transparência, Formações | ❌ | Admin ainda aplica direto; falta usar createPendingSiteChange |
