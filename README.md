# Cadastro de Cursos (MVP 1)

Sistema web em **Next.js (App Router) + TypeScript + Prisma + PostgreSQL (Vercel Postgres)** com:

- **Autenticação** via cookie HttpOnly + **JWT (HMAC)** (`jose`)
- **RBAC**: `MASTER` e `ADMIN`
- **Bootstrap**: o primeiro usuário criado vira `MASTER` em `/setup` e depois o `/setup` fica bloqueado
- **Módulos base (MASTER)**: Usuários Admin, Professores (soft delete), Cursos, Turmas
- **Auditoria mínima** (`AuditLog`) para criação/edição/inativação e criação de Admin

> O módulo de **Alunos** não está implementado no MVP 1, mas a estrutura já está preparada para evoluir.

---

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS**
- **Prisma**
- **PostgreSQL** (recomendado: **Vercel Postgres**)
- **Zod** (validação)
- **bcryptjs** (hash de senha)
- **jose** (JWT)

---

## Pré-requisitos

- Node.js 18+ (recomendado 20+)
- npm
- Uma conexão PostgreSQL (local, Docker, Neon, ou **Vercel Postgres**)

---

## Configuração de ambiente

1. Copie o exemplo:

```bash
cp .env.example .env
```

2. Ajuste:

- **`DATABASE_URL`**: string de conexão do Postgres
- **`AUTH_SECRET`**: segredo forte (em produção é obrigatório)

Exemplo:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/cadastro_cursos?schema=public"
AUTH_SECRET="coloque-um-segredo-forte-aqui"
```

Para gerar `AUTH_SECRET`:

```bash
openssl rand -hex 32
```

---

## Banco de dados (Prisma)

Após configurar `DATABASE_URL`:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

> Isso cria as tabelas e o Prisma Client em `src/generated/prisma`.

---

## Rodando localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

- Se não existir nenhum usuário no banco, você será redirecionado para **`/setup`** para criar o `MASTER`.
- Depois disso, o fluxo normal é **`/login`** e **`/dashboard`**.

---

## Rotas principais

- **`/setup`**: cria o primeiro usuário como `MASTER` (apenas quando não existe usuário)
- **`/login`**: login
- **`/dashboard`**: área logada (MASTER/ADMIN)
- **`/users`**: listar/criar Admin (somente MASTER)
- **`/teachers`**: CRUD (somente MASTER) com soft delete
- **`/courses`**: CRUD (somente MASTER) com status
- **`/class-groups`**: CRUD (somente MASTER) com vínculo curso/professor

---

## RBAC (regras implementadas no MVP 1)

- **Bootstrap**: se `User.count() === 0`, `/setup` permite criar `MASTER`
- **MASTER**:
  - acessa tudo do MVP
  - cria `ADMIN` (via `/users` e `POST /api/admin/users`)
- **ADMIN**:
  - acessa `/dashboard`
  - (módulo aluno virá depois)

> O middleware valida o JWT no Edge e aplica restrição por rota. As APIs também reforçam RBAC no backend.

---

## Deploy na Vercel (com Vercel Postgres)

1. Suba o projeto para um repositório Git (GitHub/GitLab/Bitbucket).
2. Na Vercel, importe o projeto.
3. Adicione um banco **Vercel Postgres** ao projeto.
4. Em **Environment Variables**, confira se `DATABASE_URL` foi criado automaticamente (normalmente sim).
5. Adicione **`AUTH_SECRET`** em Production/Preview.
6. Rode as migrations:

- Opção A (recomendado): localmente, apontando para o `DATABASE_URL` da Vercel:

```bash
npx prisma migrate deploy
```

- Opção B: via Vercel (build hook) — você pode configurar o pipeline para executar `prisma migrate deploy` no build.

---

## Estrutura (alto nível)

- `src/lib/*`: helpers (`auth`, `prisma`, `audit`, `validators`)
- `src/app/api/*`: Route Handlers com Prisma + Zod + RBAC
- `src/app/(auth)/*`: páginas de login/setup
- `src/app/(protected)/*`: páginas protegidas com sidebar
