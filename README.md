# Cadastro de Cursos (MVP 1)

Sistema web em **Next.js (App Router) + TypeScript + Prisma + PostgreSQL (Vercel Postgres)** com:

- **Autenticação** via cookie HttpOnly + **JWT (HMAC)** (`jose`)
- **RBAC**: `MASTER` e `ADMIN`
- **Bootstrap**: o primeiro usuário criado vira `MASTER` em `/setup` e depois o `/setup` fica bloqueado
- **Módulos base (MASTER)**: Usuários Admin, Professores (soft delete), Cursos, Turmas, Feriados
- **Geração automática de aulas de Turma** até completar a **carga horária do curso** (ex.: 20h), a partir da data de início + dias da semana; **não gera aula em feriados** cadastrados
- **Auditoria mínima** (`AuditLog`) para criação/edição/inativação, criação de Admin, geração de sessões, exclusão/inativação de curso, reativação de professor, edição/desativação de admin

- **Alunos**: CRUD (ADMIN e MASTER); apenas MASTER pode excluir (soft delete) e reativar. **Anexos** (documento RG/CPF/CNH e comprovante de endereço) via **Cloudinary** (upload assinado; nunca expor API secret no frontend).

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

- **`DATABASE_URL`** (ou **`POSTGRES_URL`**): string de conexão do Postgres. Use **`sslmode=verify-full`** na URL para evitar aviso de segurança do driver `pg` (em vez de `require`).
- **`AUTH_SECRET`**: segredo forte (em produção é obrigatório).
- **Cloudinary** (para anexos do aluno): crie conta em [cloudinary.com](https://cloudinary.com) (plano gratuito) e preencha:
  - **`CLOUDINARY_CLOUD_NAME`**
  - **`CLOUDINARY_API_KEY`**
  - **`CLOUDINARY_API_SECRET`** (nunca expor no frontend)
  - **`CLOUDINARY_UPLOAD_FOLDER`** (opcional; padrão: `igh/students`)
- **E-mail (Resend)** – boas-vindas e confirmação de inscrição do aluno:
  - **`RESEND_API_KEY`**: API Key em [resend.com](https://resend.com) (free tier)
  - **`APP_URL`**: URL base do app (ex.: `http://localhost:3000` ou `https://seu-dominio.vercel.app`) para links nos e-mails
  - **`EMAIL_FROM`**: remetente (use `onboarding@resend.dev` para testes; em produção use domínio verificado no Resend)

Exemplo:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/cadastro_cursos?schema=public"
AUTH_SECRET="coloque-um-segredo-forte-aqui"

CLOUDINARY_CLOUD_NAME=seu_cloud_name
CLOUDINARY_API_KEY=sua_api_key
CLOUDINARY_API_SECRET=sua_api_secret
CLOUDINARY_UPLOAD_FOLDER=igh/students
```

Para gerar `AUTH_SECRET`:

```bash
openssl rand -hex 32
```

---

## Banco de dados (Prisma)

Após configurar as variáveis de ambiente:

```bash
npx prisma generate
npx prisma migrate dev --name init           # primeira vez
npx prisma migrate dev --name add_class_sessions  # quando aplicar o módulo de sessões
```

> Isso cria/atualiza as tabelas e o Prisma Client em `src/generated/prisma`.

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
- **`/users`**: listar/criar/editar/desativar Admin (somente MASTER)
- **`/teachers`**: CRUD (somente MASTER), filtro Ativos/Inativos/Todos, reativar inativos
- **`/courses`**: CRUD (somente MASTER) com status; excluir (hard delete se sem turmas, inativar se tiver turmas)
- **`/class-groups`**: CRUD (somente MASTER) com vínculo curso/professor; aulas geradas por carga horária do curso
- **`/holidays`**: CRUD de feriados (somente MASTER); datas em que não são geradas aulas
- **`/students`**: CRUD de alunos (ADMIN e MASTER); anexos (documento e comprovante de endereço) via Cloudinary; apenas MASTER pode excluir aluno ou remover anexo
- **`/enrollments`**: Matrículas (MASTER); ao matricular aluno em uma turma, envia e-mail de boas-vindas com link de confirmação e senha temporária
- **`/confirmar-inscricao`**: Página pública; o aluno acessa pelo link do e-mail, aceita os termos e confirma a inscrição
- **`/trocar-senha`**: Troca de senha obrigatória no primeiro acesso (senha temporária)

---

## RBAC (regras implementadas no MVP 1)

- **Bootstrap**: se `User.count() === 0`, `/setup` permite criar `MASTER`
- **MASTER**:
  - acessa tudo do MVP
  - cria `ADMIN` (via `/users` e `POST /api/admin/users`)
- **ADMIN**:
  - acessa `/dashboard`, `/students` (criar/editar alunos e anexar documentos; não pode excluir aluno nem remover anexo)

> O **proxy** (`src/proxy.ts`, ex-middleware) valida o JWT no Edge e aplica restrição por rota. As APIs também reforçam RBAC no backend.

---

## Feriados e geração de aulas

### Cadastro de feriados

- Acesse **Feriados** no menu (somente MASTER).
- Dois tipos de feriado:
  - **Todo ano (mesmo dia e mês)**: informe apenas **dia e mês** (ex.: 01/01 para Ano Novo). O feriado se repete em todos os anos; o ano não é armazenado.
  - **Data específica (com ano)**: informe **data completa** (ex.: segundo domingo de outubro de 2025 para Círio de Nazaré). Use para feriados que mudam de data a cada ano.
- Opcionalmente informe o **nome** do feriado.
- Feriados **ativos** são considerados na geração de aulas (nenhuma aula é criada nessas datas).
- É possível **inativar** um feriado (sem excluir) ou **excluir** definitivamente.

### Anexos do aluno (Cloudinary)

- No cadastro do aluno (ao **editar**), a seção **Anexos** permite enviar **Documento (RG/CPF/CNH)** e **Comprovante de endereço**.
- Formatos: PDF, JPG, PNG. Tamanho máximo: 5MB. Upload é feito com assinatura gerada no backend; a API secret do Cloudinary nunca é exposta no frontend.
- Apenas um arquivo ativo por tipo; ao enviar outro, o anterior é marcado como removido (soft delete). Apenas MASTER pode remover anexos.
- Para testar: configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (e opcionalmente `CLOUDINARY_UPLOAD_FOLDER`) no `.env`.

### Como funciona a geração de aulas (turmas)

1. **Curso** deve ter **carga horária** definida (ex.: 20h). Sem isso, não é possível criar/atualizar turma com geração de aulas.
2. Ao **criar** ou **editar** uma turma (alterando data de início, dias da semana, horário de início/fim ou curso), o sistema:
   - Gera datas de aula apenas nos **dias da semana** configurados (ex.: SEG, QUA), a partir da **data de início**.
   - **Não cria aula** em datas que estejam cadastradas como feriado (ativo).
   - **Interrompe** a geração quando o total de horas das aulas geradas atinge (ou ultrapassa levemente) a **carga horária do curso**.
3. A **duração de cada aula** é calculada pelo horário de início e fim da turma (ex.: 08:00–10:00 = 2h).
4. Na listagem e no detalhe da turma são exibidos **total de aulas** e **total de horas** geradas.

---

## E-mail e confirmação de inscrição

- **Admin e Professor**: ao criar usuário, o sistema gera uma **senha temporária**, envia por e-mail (Resend) e define **troca obrigatória no primeiro login**.
- **Aluno**: ao criar uma **matrícula** (Menu **Matrículas** → Nova matrícula: selecionar aluno com e-mail e turma), o sistema envia um e-mail com:
  - Dados da turma/curso (nome, início, dias, horário, local)
  - **Senha temporária** de acesso ao sistema
  - **Link "Confirme sua inscrição"** que leva a `/confirmar-inscricao?token=...`
- Na página de confirmação o aluno marca "Li e aceito os termos" e clica em **Confirmar**; o sistema registra `enrollmentConfirmedAt`, `termsAcceptedAt` e redireciona para o login.
- **Como testar**: (1) Crie um aluno com e-mail. (2) Em **Matrículas**, clique em **Nova matrícula**, selecione o aluno e uma turma, envie. (3) Verifique o e-mail (ou logs em desenvolvimento se `RESEND_API_KEY` não estiver definida). (4) Abra o link de confirmação no e-mail (ou use o link gerado com o token que você pode obter do banco na tabela `VerificationToken` para testes). (5) Aceite os termos e confirme. (6) No banco, a matrícula (`Enrollment`) deve ter `enrollmentConfirmedAt` e `termsAcceptedAt` preenchidos.

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
