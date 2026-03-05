# Proposta de melhorias – Cadastro de Cursos

Análise do projeto com sugestões priorizadas. Itens já aplicados ou de maior impacto estão destacados.

---

## 1. Segurança

### 1.1 `.env.example` sem segredos reais ✅ (aplicado)
- **Problema:** O arquivo continha valores que pareciam reais (URL do banco, API keys, `AUTH_SECRET`).
- **Ação:** `.env.example` foi substituído por um modelo só com placeholders. **Importante:** troque todas as credenciais reais que já tenham sido commitadas (banco, Cloudinary, Resend, AUTH_SECRET) e nunca commite `.env` com segredos.

### 1.2 Exigir `AUTH_SECRET` em produção
- Em `src/lib/auth.ts` e `src/middleware.ts` hoje há fallback `process.env.AUTH_SECRET || "dev-secret-change-me"`.
- **Sugestão:** Em produção, falhar explicitamente se `AUTH_SECRET` não estiver definido (e não usar o fallback), para evitar JWT com segredo fraco.

### 1.3 Rate limiting no login
- **Sugestão:** Limitar tentativas de login por IP ou por e-mail (ex.: 5 tentativas em 5 minutos) para reduzir força bruta. Pode ser via middleware, Vercel Edge Config ou serviço externo.

### 1.4 Proteção de rotas no middleware
- O `matcher` do middleware não inclui `/meus-dados`, `/trocar-senha`, `/escolher-perfil`, `/holidays`, `/time-slots`. Essas rotas estão sob o layout `(protected)`, que já redireciona não autenticados.
- **Sugestão:** Incluir essas rotas no `matcher` do middleware para que a verificação de auth ocorra antes (e de forma consistente com o resto da área logada).

---

## 2. Testes

### 2.1 Testes automatizados
- Não há testes (unitários ou e2e) no repositório.
- **Sugestão:**
  - **Unitários:** funções puras em `lib/` (validadores Zod, formatação, regras de negócio).
  - **Integração:** APIs críticas (login, matrícula, confirmação de inscrição) com banco em memória ou container.
  - **E2E (opcional):** fluxos principais (login → dashboard, nova matrícula) com Playwright ou Cypress.

---

## 3. Experiência do usuário (UX)

### 3.1 Feedback ao falhar carregamento de listas
- Em várias telas (ex.: enrollments, students), quando a API falha só aparece um toast; a lista fica vazia sem mensagem clara.
- **Sugestão:** Estado de “erro ao carregar” com botão “Tentar novamente” em listagens e selects (ex.: turmas no modal de nova matrícula).

### 3.2 Filtro de turma na página de matrículas
- O dashboard já tem links para “Matrículas” por turma; a página de matrículas não usa `?turma=id` na URL.
- **Sugestão:** Ao abrir `/enrollments?turma=<id>`, pré-selecionar a turma no modal “Nova matrícula” ou em um filtro, facilitando o fluxo vindo do dashboard.

### 3.3 Confirmação antes de ações destrutivas
- Já existe `confirm()` em exclusão de matrícula.
- **Sugestão:** Revisar outras exclusões (aluno, professor, turma, etc.) e garantir confirmação e, se possível, mensagem de sucesso consistente.

### 3.4 Paginação ou virtualização em listas grandes
- Listas como matrículas e alunos carregam tudo de uma vez.
- **Sugestão:** Para muitos registros, adicionar paginação (ou infinite scroll) no backend e no front para melhor performance e usabilidade.

---

## 4. Acessibilidade (a11y)

- Já há uso de `aria-label`, `sr-only` e associação de labels em alguns componentes (ex.: select de perfil na Sidebar).
- **Sugestão:** Estender para formulários principais (login, matrícula, meus dados): garantir que todos os campos tenham `<label>` associado ou `aria-label`, e que mensagens de erro sejam anunciadas (ex.: `aria-live` ou `role="alert"`).

---

## 5. Código e arquitetura

### 5.1 Tratamento de erro nas APIs
- Várias rotas usam `try/catch` e retornam 500 com mensagem genérica; outras deixam o erro propagar.
- **Sugestão:** Padronizar: em desenvolvimento logar o erro; em produção retornar mensagem genérica e usar um logger (ex.: estrutura para enviar a stack para um serviço).

### 5.2 Duplicação do segredo JWT
- `AUTH_SECRET` é codificado em `auth.ts`, `middleware.ts` e `student-token.ts`.
- **Sugestão:** Centralizar em um único módulo (ex.: `lib/auth-secret.ts`) que exporta o `TextEncoder().encode(process.env.AUTH_SECRET)` e importar onde for necessário.

### 5.3 Tipos da API
- `ApiResponse` / `ApiErr` existem em `lib/http.ts` e `lib/api-types.ts`.
- **Sugestão:** Manter um único lugar (ex.: `api-types.ts`) e importar de lá nas rotas para evitar divergência.

### 5.4 Componentes muito grandes
- Algumas páginas (ex.: `enrollments/page.tsx`, `StudentForm.tsx`) têm muitas responsabilidades.
- **Sugestão:** Extrair hooks (ex.: `useEnrollments`, `useFormOptions`) e subcomponentes (ex.: modal de nova matrícula, bloco de certificado) para facilitar manutenção e testes.

---

## 6. Performance

### 6.1 Queries do dashboard
- O dashboard já usa `Promise.all` para as contagens; está adequado.
- **Sugestão:** Se no futuro o número de turmas “abertas” crescer muito, limitar ou paginar a lista no `getDashboardData`.

### 6.2 Bundle do front
- Uso de `lucide-react`, `react-icons` e `@tiptap/*` pode aumentar o bundle.
- **Sugestão:** Verificar tree-shaking e importar apenas ícones e extensões usadas; considerar lazy load para o editor rich text em rotas que não usam.

---

## 7. DevOps e ambiente

### 7.1 Scripts no `package.json`
- **Sugestão:** Adicionar scripts como `build:check` (só compilar, sem gerar artefato de produção) e `db:push` / `db:migrate` para uso em CI ou documentação.

### 7.2 Variáveis de ambiente em produção
- Garantir que em produção estejam definidos: `AUTH_SECRET`, `POSTGRES_URL`, `RESEND_API_KEY`, `APP_URL`, `EMAIL_FROM` e, se usar upload, todas as variáveis do Cloudinary.

---

## Resumo de prioridade

| Prioridade | Item |
|-----------|------|
| Alta      | `.env.example` sem segredos reais ✅; trocar credenciais já vazadas; exigir AUTH_SECRET em produção |
| Média     | Incluir rotas faltantes no matcher do middleware; rate limit no login; estado de erro “Tentar novamente” nas listagens |
| Média     | Testes para login e matrícula; centralizar AUTH_SECRET |
| Baixa     | Paginação em listas grandes; refatorar páginas muito grandes; a11y em formulários |

Se quiser, posso ajudar a implementar algum desses itens no código (por exemplo: middleware, AUTH_SECRET em produção ou estado de erro nas listagens).
