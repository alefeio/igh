# Ambiente de desenvolvimento local

Banco PostgreSQL só nesta máquina, separado dos bancos de produção do IGH e do INAC. Não copie o `.env` de produção para esta pasta.

## Pré-requisitos

- Node.js e npm (o projeto usa Next.js 16)
- Docker Desktop ou Docker Engine com `docker compose`

## Primeiro uso

```bash
git clone <url-do-repositorio>
cd cadastro-cursos
npm install
```

Copie o exemplo de ambiente:

```bash
# Windows PowerShell
Copy-Item .env.example .env.local
```

```bash
# macOS / Linux
cp .env.example .env.local
```

O `.env.local` não é versionado. Troque `AUTH_SECRET` por um valor seu. Não use o segredo de produção.

As URLs `APP_DATABASE_URL` e `APP_DIRECT_URL` do exemplo apontam para `127.0.0.1:5432` e o banco `igh_dev`. No Docker local não há pooler: as duas usam a mesma instância. Se a porta 5432 desta máquina estiver ocupada, mude o mapeamento em `docker-compose.dev.yml` e as duas URLs juntas. Não aponte para `db.prisma.io`.

## Banco local

```bash
npm run db:dev:bootstrap
npm run dev
```

`db:dev:bootstrap` sobe o Docker, cria o schema atual no `igh_dev` e marca as migrations antigas como já aplicadas só nesse banco local. As migrations históricas não são editadas e não são executadas em sequência. O comando recusa `db.prisma.io` e qualquer host que não seja localhost. Se o banco local já estiver pronto, ele não apaga nada.

No dia a dia, depois que o banco existe:

```bash
npm run db:dev:up
npm run db:dev:migrate
npm run dev
```

`db:dev:migrate` aplica só migrations novas.

Abra [http://localhost:3000/setup](http://localhost:3000/setup) e crie um usuário Master fictício (nome, e-mail e senha que não existam em produção). Esse passo só aparece enquanto o banco não tem usuários.

Logs e desligamento:

```bash
npm run db:dev:logs
npm run db:dev:down
```

## Seed opcional

O `npm run seed` **não** é o primeiro passo. Ele grava conteúdo institucional do repositório (ciclo, textos legais, onboarding, página do Espaço Maker e modelos de documento). Não cria o Master e não traz alunos.

O app sobe sem esse seed: o Master nasce em `/setup`. Se quiser o conteúdo institucional no banco local, use só o comando protegido:

```bash
npm run db:dev:seed
```

Não rode `npm run seed` enquanto existir um `.env` de produção nesta pasta. Esse comando usa a URL que o Prisma encontrar e pode atingir produção.

## O que não vai funcionar sem chaves de terceiros

É esperado no primeiro login local:

- e-mail, se `RESEND_API_KEY` estiver vazia
- SMS real, porque `SMS_PROVIDER=mock`
- upload Apimages/Cloudinary, OpenAI e Turnstile, sem as chaves
- crons do `vercel.json`, que só existem no deploy da Vercel

## Nunca usar produção

- Não copie `APP_DATABASE_URL`, `APP_DIRECT_URL` nem `AUTH_SECRET` dos projetos IGH ou INAC na Vercel.
- Não deixe um `.env` de produção dentro de `cadastro-cursos` quando for desenvolver. O Next carrega `.env` e depois `.env.local`. O `.env.local` cobre as chaves que ele mesmo define; uma chave que só exista no `.env` de produção continua valendo.
- O arquivo `.env` desta máquina de quem já opera produção pode continuar fora do Git. O fluxo de um clone novo usa apenas `.env.local`.

## Recriar o banco Docker do zero

Isto apaga somente o volume local `igh_dev_pgdata`. Não faz nada no Prisma Postgres de produção.

```bash
# Windows PowerShell
$env:DEV_DB_RESET_CONFIRM="yes"; npm run db:dev:reset
```

```bash
# macOS / Linux
DEV_DB_RESET_CONFIRM=yes npm run db:dev:reset
```

Depois:

```bash
npm run db:dev:bootstrap
```

Acesse de novo `/setup` para criar outro Master fictício.

Nunca entregue o arquivo `.env` de produção a quem for desenvolver. O clone novo usa só `.env.local`.
