# Prompt para o Cursor — Criar branch limpa do Quadro de Atividades

A auditoria confirmou o **Cenário C**: o Quadro de Atividades não depende de runtime de `feat/matriculas-e-turmas`, mas a branch atual herdou o commit `8d125db`. Crie uma branch limpa a partir de `origin/main`, aplique somente o Quadro de Atividades e retire os prompts de desenvolvimento do commit.

Esta tarefa autoriza operações locais de Git necessárias para criar o novo checkpoint. **Não faça push, PR, migration, deploy ou alterações no Vercel. Não apague a branch antiga.**

## 1. Verificações antes de começar

- Execute `git status` e confirme que não existem alterações de código não salvas.
- O arquivo local não commitado `docs/Prompt_Cursor_Auditoria_Pre_Push_Quadro_Atividades.md`, se ainda existir, não deve ser incluído em nenhum commit. Não o apague sem necessidade; apenas preserve-o fora do stage.
- Confirme que o commit de origem é `02a275b`.
- Execute `git fetch origin` para atualizar as referências remotas.
- Confirme que `origin/main` existe.
- Verifique se a branch `feat/quadro-atividades-belem-clean` já existe local ou remotamente.
- Se ela já existir, não a sobrescreva nem force nada: pare e informe.

## 2. Criar a branch limpa

Crie:

```bash
git checkout -b feat/quadro-atividades-belem-clean origin/main
```

Em seguida, aplique:

```bash
git cherry-pick 02a275b
```

É esperado que possa ocorrer conflito em `prisma/schema.prisma`. Não resolva usando “aceitar tudo” de nenhum lado.

## 3. Resolver o schema corretamente

O resultado deve partir do schema atual de `origin/main` e acrescentar somente o necessário para o Quadro de Atividades:

- `User.canCreateBoardTasks` com `default false`;
- relações necessárias em `User` e `PoloLocation`;
- modelos `BoardActivity`, `BoardActivityComment`, `BoardActivityReaction` e `BoardActivityEvent`;
- enums do Quadro de Atividades;
- valores de notificação `BOARD_ACTIVITY_ASSIGNED` e `BOARD_ACTIVITY_COMMENT`;
- índices, uniques e regras `onDelete` definidos no MVP aprovado.

Não traga da branch de matrículas:

- `enrollmentInviteToken`;
- relações ou campos do convite de matrícula;
- migration `20260923180000_class_group_enrollment_invite_token`;
- APIs, páginas, componentes ou tipos do fluxo de matrículas.

Preserve todo o restante do schema de `origin/main`.

Depois da resolução, execute `prisma format` e confira o diff do schema antes de continuar.

## 4. Retirar os prompts de desenvolvimento

Os seguintes arquivos são histórico de trabalho e não devem integrar o repositório da aplicação:

- `docs/Prompt_Cursor_MVP_Quadro_Atividades_Belem.md`;
- `docs/Prompt_Cursor_Hardening_Pre_Migration_Quadro_Atividades.md`;
- `docs/Prompt_Cursor_Checkpoint_Commit_Quadro_Atividades.md`.

Mantenha:

- `docs/quadro-atividades-deploy.md`.

Se o cherry-pick estiver interrompido por conflito, remova os três prompts do índice antes de executar `git cherry-pick --continue`, para que o commit limpo já nasça sem eles.

Se o cherry-pick concluir automaticamente, remova os três arquivos e use `git commit --amend --no-edit`, pois a branch ainda não foi publicada.

O arquivo local `docs/Prompt_Cursor_Auditoria_Pre_Push_Quadro_Atividades.md` também não deve ser adicionado ao stage.

## 5. Validar que matrículas não foram herdadas

Compare a nova branch com `origin/main` e confirme:

- não existe o commit `8d125db` na ancestralidade exclusiva da nova branch;
- não existe a migration de convite de matrícula;
- o diff não contém `/turma/[token]`, importação Excel, modal pós-matrícula ou APIs de convite;
- `enrollmentInviteToken` não foi introduzido pelo commit do quadro;
- a única migration nova é `20260924150000_board_activities_mvp`;
- os três prompts não aparecem no diff;
- `docs/quadro-atividades-deploy.md` permanece.

Use como referência:

```bash
git log --oneline origin/main..HEAD
git diff --name-status origin/main...HEAD
git diff --stat origin/main...HEAD
```

O resultado esperado é um único commit funcional do Quadro de Atividades sobre `origin/main`.

## 6. Executar validações

Execute:

- `prisma format`;
- `prisma validate`;
- `prisma generate`;
- os 24 testes do módulo;
- ESLint nos arquivos novos e modificados pelo Quadro de Atividades;
- typecheck com `NODE_OPTIONS=--max-old-space-size=8192`, se o ambiente permitir.

No typecheck:

- erros antigos já conhecidos podem ser relatados separadamente;
- não aceite nenhum erro novo relacionado ao Quadro;
- não use `any`, `@ts-ignore` ou desativação de regras para forçar sucesso.

Não execute build se houver risco de conexão com banco de produção ou OOM.

## 7. Conferir o commit resultante

Antes de finalizar:

- execute `git show --stat --name-status HEAD`;
- faça busca por possíveis segredos;
- confirme que nenhum `.env`, URL, UUID real, token ou credencial foi incluído;
- confirme que o histórico possui somente a base `origin/main` e o novo commit do quadro;
- não modifique nem exclua a branch antiga `feat/quadro-atividades-belem`;
- não faça push.

Se o commit resultar em um novo hash, isso é esperado por causa do cherry-pick e da retirada dos prompts.

## 8. Retorno esperado

Apresente:

1. branch criada;
2. hash do novo commit;
3. confirmação da base em `origin/main`;
4. explicação da resolução de `prisma/schema.prisma`;
5. lista de arquivos do fluxo de matrículas que foram excluídos do resultado;
6. confirmação da retirada dos três prompts;
7. lista final de arquivos alterados contra `origin/main`;
8. resultados de Prisma, testes, ESLint e typecheck;
9. `git status` final, incluindo eventual prompt local não rastreado;
10. confirmação de que não houve push, migration, deploy ou alteração externa.

Se surgir qualquer conflito além do schema ou alguma dependência inesperada com matrículas, pare antes de concluir o cherry-pick e apresente o problema. Não improvise uma integração entre os dois recursos.
