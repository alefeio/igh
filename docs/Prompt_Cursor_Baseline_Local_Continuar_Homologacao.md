# Prompt para o Cursor — Baseline local e continuação da homologação

A tentativa de criar o banco local a partir de todas as migrations revelou um débito técnico antigo: `20260225100000_lesson_attachment_names` executa antes da criação de `CourseLesson`. Não edite essa migration já histórica e não use banco remoto.

Para homologar o Quadro de Atividades com segurança, crie um **baseline local** equivalente ao schema atual de `origin/main`, registre as migrations históricas como aplicadas somente nesse banco descartável e, depois, aplique normalmente a migration `20260924150000_board_activities_mvp`.

Esta autorização para `prisma db push` e `prisma migrate resolve` vale **exclusivamente para o novo banco PostgreSQL local em `127.0.0.1:55432`**. É proibido executar esses comandos em IGH, INAC, Neon, Vercel ou qualquer host remoto.

## 1. Manter o diagnóstico anterior preservado

- Não altere nem apague o banco local `igh_board_activities_test`, que contém o registro da falha histórica.
- Não remova o container `igh-board-activities-test-db`.
- Não remova o volume `igh-board-activities-test-data`.
- Não edite nenhuma migration antiga.
- Não use SQL manual para “corrigir” `CourseLesson`.
- Não execute `migrate resolve` no banco que ficou parcialmente migrado.

O banco anterior deve permanecer disponível apenas como evidência do problema.

## 2. Criar um segundo banco local vazio

No mesmo container PostgreSQL local, crie um banco separado chamado:

`igh_board_activities_baseline_test`

Antes de criar:

- confirme que o container está healthy;
- confirme o bind `127.0.0.1:55432`;
- confirme que o banco ainda não existe;
- não remova ou sobrescreva qualquer banco existente;
- utilize o mesmo usuário local de homologação.

Depois, configure variáveis somente para a sessão atual apontando para esse novo banco.

Antes de qualquer alteração, valide programaticamente que o hostname efetivo é `localhost` ou `127.0.0.1`, a porta é `55432` e o database é exatamente `igh_board_activities_baseline_test`.

Se qualquer valor divergir, pare imediatamente.

## 3. Obter o schema-base de `origin/main`

O baseline deve representar o sistema imediatamente antes do commit do Quadro de Atividades.

- Extraia `prisma/schema.prisma` de `origin/main` para um diretório temporário fora da árvore rastreada do repositório.
- Não faça checkout nem altere o schema da branch atual.
- Se o Prisma 7 depender de `prisma.config.ts` ou outro arquivo para resolver a URL, prepare uma configuração temporária compatível, apontando somente para o banco local.
- Não copie `.env` do projeto.
- Confirme que o schema temporário não contém `BoardActivity`, `canCreateBoardTasks` ou os novos tipos de notificação do Quadro.
- Confirme que ele contém o estado atual de `main`, inclusive as alterações de matrículas que já foram integradas.

Não adicione arquivos temporários ao Git.

## 4. Criar o schema-base no banco vazio

Use o schema temporário de `origin/main` para criar o banco-base local com `prisma db push`.

Regras:

- executar somente no banco `igh_board_activities_baseline_test`;
- o banco deve estar vazio;
- não utilizar `--accept-data-loss`;
- não utilizar schema da branch do Quadro nesta etapa;
- não gerar ou editar migration;
- não executar seed antes do baseline ser concluído;
- registrar o comando e o resultado.

Depois, verifique que tabelas centrais como `User`, `PoloLocation`, `ClassSession` e `CourseLesson` existem e que as tabelas `BoardActivity*` ainda não existem.

## 5. Registrar o baseline das migrations históricas

Liste as migrations que pertencem a `origin/main`, em ordem, sem incluir:

`20260924150000_board_activities_mvp`

Para cada migration existente em `origin/main`, use o mecanismo oficial do Prisma para marcá-la como aplicada no banco local de baseline.

É permitido executar `prisma migrate resolve --applied <migration>` somente porque:

- o schema equivalente já foi criado com o schema oficial de `origin/main`;
- o banco é descartável e local;
- estamos simulando o estado de um banco existente que já recebeu o histórico antigo.

Não marque a migration do Quadro como aplicada.

Ao terminar:

- consulte `_prisma_migrations`;
- confirme que todas as migrations de `origin/main` estão registradas como aplicadas;
- confirme que não há registro da migration do Quadro;
- confirme que não existe migration com `finished_at` nulo.

Não use `resolve --rolled-back` e não modifique checksums manualmente.

## 6. Aplicar a migration do Quadro de forma real

Volte a utilizar o schema e o diretório de migrations da branch `feat/quadro-atividades-belem-clean`.

Com as URLs ainda apontando para o banco local de baseline:

1. execute `prisma migrate status`;
2. confirme que a única migration pendente é `20260924150000_board_activities_mvp`;
3. execute `prisma migrate deploy`;
4. execute novamente `prisma migrate status`;
5. confirme que não há migrations pendentes.

Verifique no banco:

- `User.canCreateBoardTasks` com padrão `false`;
- quatro tabelas `BoardActivity*`;
- índices esperados;
- unique de reações;
- chaves estrangeiras e `onDelete`;
- registro concluído da migration em `_prisma_migrations`.

Esse é o teste relevante para produção: aplicar a nova migration sobre um schema-base equivalente ao estado atual de `main`.

## 7. Verificar ausência de drift relevante

Use o comando oficial do Prisma compatível com a versão do projeto para comparar:

- o banco local após a migration; e
- o schema atual da branch do Quadro.

Se houver diferença:

- não corrija com SQL manual;
- informe o diff;
- diferencie diferenças esperadas de defaults/extensões de drift real;
- pare antes do seed se o drift afetar o módulo.

## 8. Preparar dados fictícios

Se o baseline e a migration forem concluídos corretamente, prossiga com dados totalmente fictícios.

Inspecione o seed existente. Execute-o somente se for local, previsível e sem efeitos externos. Caso contrário, crie dados temporários pelo mecanismo mais seguro, sem versionar scripts até aprovação.

Crie no mínimo:

- unidade fictícia ativa “Belém — Homologação”;
- Master/Admin local;
- profissional interno com permissão de criação;
- professor inicialmente sem permissão;
- terceiro profissional interno;
- estudante;
- curso e turma fictícios quando exigidos;
- `ClassSession` normal para hoje;
- duas sessões sobrepostas para testar conflito;
- sessão cancelada.

Não utilize nomes, documentos, telefones ou e-mails reais.

Configure `BOARD_ACTIVITIES_POLO_LOCATION_ID` somente com o UUID local criado e ative `BOARD_ACTIVITIES_ENABLED=true` apenas na sessão local.

## 9. Continuar os smoke tests

Valide no banco e nas APIs locais:

- gate desligado bloqueia;
- gate ligado e unidade local válida libera;
- estudante não acessa;
- sem permissão não cria;
- Master/Admin habilita o professor;
- criador e responsável movem status;
- terceiro não move;
- comentários e reações funcionam;
- reação não duplica;
- eventos de histórico são gravados;
- filtro respeita `America/Belem`;
- agenda mostra sessão normal, cancelada e conflito.

## 10. Disponibilizar para homologação visual

Se os smoke tests passarem:

- suba o aplicativo apenas em `127.0.0.1`;
- confirme antes que todas as URLs do processo apontam para o banco local de baseline;
- mantenha serviços externos desativados;
- forneça URL de login e `/gestao/atividades`;
- forneça credenciais descartáveis dos perfis de teste;
- informe como iniciar e parar o app;
- mantenha container, volume e bancos locais enquanto a homologação estiver em andamento.

Não exponha o servidor publicamente.

## 11. Registrar o débito técnico separadamente

Documente no retorno, sem editar migrations antigas, que o histórico atual não consegue construir um banco vazio por causa da ordem da migration `20260225100000_lesson_attachment_names`.

Recomende uma tarefa futura específica para:

- definir estratégia oficial de baseline para novos ambientes e recuperação de desastre;
- testar criação de banco vazio em CI;
- impedir novas migrations fora de ordem.

Essa dívida não deve ser resolvida dentro do commit do Quadro.

## 12. Retorno esperado

Apresente:

1. confirmação de que todas as operações ocorreram em `127.0.0.1:55432`;
2. banco antigo preservado e novo banco criado;
3. origem e validação do schema-base de `origin/main`;
4. resultado do `db push` no banco vazio;
5. lista/quantidade de migrations históricas marcadas como aplicadas;
6. confirmação de que a migration do Quadro foi a única aplicada por `migrate deploy`;
7. resultado de `migrate status` e verificação de drift;
8. dados fictícios criados;
9. resultados dos smoke tests;
10. URL e credenciais locais para homologação visual;
11. comandos para iniciar/parar o ambiente;
12. `git status` final;
13. débito técnico registrado;
14. confirmação de que não houve push, commit, deploy, alteração externa ou conexão remota.

Se qualquer etapa tentar resolver uma URL não local, pare antes de modificar o banco. Produção não é alternativa para esta homologação.
