# Prompt para o Cursor — Gate desligado, build local e auditoria Vercel pré-push

A homologação técnica local do Quadro de Atividades foi concluída com sucesso no banco `igh_board_activities_baseline_test`. Antes de autorizar push ou PR, faça três verificações finais:

1. testar o gate desligado em runtime;
2. tentar o build usando exclusivamente o PostgreSQL local;
3. auditar, somente para leitura, as configurações de Preview dos projetos Vercel IGH e INAC.

**Não faça push, PR, deploy, migration remota ou alteração de variáveis externas.**

## 1. Estado inicial

- Confirme a branch `feat/quadro-atividades-belem-clean`.
- Confirme `HEAD` no commit aprovado `43db477`, salvo se houver novo commit explicitamente informado.
- Execute `git status`.
- Não adicione os arquivos locais `docs/Prompt_Cursor_*` ao stage.
- Confirme que o container `igh-board-activities-test-db` está healthy.
- Confirme que o banco de homologação é `igh_board_activities_baseline_test` em `127.0.0.1:55432`.
- Confirme que nenhuma variável efetiva aponta para IGH, INAC, Neon ou outro host remoto.

## 2. Teste real com o gate desligado

Pare o servidor local atual de forma controlada e reinicie-o usando o mesmo banco local, mas com:

`BOARD_ACTIVITIES_ENABLED=false`

Mantenha `BOARD_ACTIVITIES_POLO_LOCATION_ID` com o UUID local ou deixe-o ausente conforme a regra implementada. O resultado precisa ser o mesmo: recurso indisponível.

Teste com usuário Admin autenticado:

- item **Quadro de Atividades** não aparece no menu;
- acesso direto a `/gestao/atividades` é negado de forma controlada;
- APIs de listagem, criação, permissões e agenda são negadas;
- nenhuma consulta ou alteração é feita nas tabelas do Quadro;
- outras páginas do sistema continuam funcionando.

Registre os status HTTP reais e o comportamento visual, sem depender somente dos testes unitários.

Depois, reinicie localmente com:

- `BOARD_ACTIVITIES_ENABLED=true`;
- `BOARD_ACTIVITIES_POLO_LOCATION_ID` igual ao UUID da unidade fictícia local.

Confirme que menu, página e API voltam a funcionar. Não altere arquivos de ambiente versionados.

## 3. Build isolado com banco local

Antes do build:

- pare o servidor de desenvolvimento;
- mantenha o PostgreSQL local ativo;
- confirme novamente host `127.0.0.1`, porta `55432` e database `igh_board_activities_baseline_test`;
- mantenha integrações externas desativadas;
- use segredo de autenticação apenas local;
- não leia nem reutilize URLs de produção;
- mantenha o gate desligado durante o build, salvo se o código exigir validação do gate ligado — nesse caso, use somente o UUID local.

Execute o script oficial:

`npm run build`

O projeto já configura `next build --webpack` e heap de 12 GB. Não aumente indefinidamente o limite de memória e não altere o script apenas para obter sucesso.

Se o build:

- **passar:** registre duração e resultado;
- **falhar por OOM:** registre o código e a última etapa alcançada;
- **falhar por TypeScript/ESLint:** diferencie erro preexistente de erro do Quadro;
- **falhar por conexão:** interrompa e confirme que nenhuma tentativa foi remota;
- **executar efeitos externos inesperados:** pare imediatamente e relate.

Não corrija problemas fora do escopo nesta etapa. Se encontrar erro novo do Quadro, pare antes de qualquer push e descreva-o.

## 4. Auditoria somente leitura dos projetos Vercel

Identifique os dois projetos Vercel correspondentes a IGH e INAC usando configurações locais já existentes ou CLI autenticada.

Não crie, altere, remova ou promova deployments. Não adicione nem remova variáveis.

Para cada projeto, determine:

- nome/identificador do projeto;
- branch de produção;
- integração Git ativa;
- se push de uma nova branch dispara Preview automaticamente;
- nomes das variáveis disponíveis no escopo Preview;
- se `APP_DATABASE_URL`, `APP_DIRECT_URL` ou equivalentes existem no Preview;
- se `BOARD_ACTIVITIES_ENABLED` existe no Preview;
- se `BOARD_ACTIVITIES_POLO_LOCATION_ID` existe no Preview.

Para saber se o Preview está ligado a produção, é permitido baixar as variáveis de Preview para um arquivo temporário fora do repositório, somente se a CLI já estiver autenticada e isso for uma operação de leitura.

Regras obrigatórias:

- nunca imprima URLs completas, usuários, senhas ou tokens;
- analise apenas hostname, nome lógico do banco e escopo;
- classifique a conexão como **produção**, **homologação**, **ausente** ou **não confirmado**;
- não conecte à URL baixada;
- não execute Prisma contra essa URL;
- destrua com segurança o arquivo temporário após a análise;
- confirme que ele não entrou no Git.

Se a CLI não estiver autenticada ou o projeto não estiver vinculado, não tente contornar o acesso. Classifique como “não confirmado”.

## 5. Matriz de segurança para o push

Classifique cada projeto:

| Projeto | Preview automático | Banco no Preview | Gate no Preview | Push seguro? |
|---|---:|---|---|---|
| IGH | Sim/Não | Produção/Homologação/Ausente/Não confirmado | On/Off/Ausente | Sim/Não |
| INAC | Sim/Não | Produção/Homologação/Ausente/Não confirmado | On/Off/Ausente | Sim/Não |

Considere o push **não seguro** quando:

- o Preview usa banco de produção;
- a origem do banco não puder ser confirmada;
- o Preview herda variáveis de Production sem separação clara;
- o gate possa ficar ativo no INAC;
- o build/runtime do Preview dependa de banco, mas não exista banco seguro;
- o push dispara deploy automático cujo comportamento não esteja compreendido.

O gate desligado reduz exposição funcional, mas não torna aceitável conectar um Preview ao banco de produção.

## 6. Próxima recomendação

Com base nas evidências, recomende apenas uma destas opções:

### Opção A — Push seguro

Somente se os Previews estiverem isolados de produção ou se for comprovado que nenhum Preview será criado/executado. Ainda assim, não faça o push nesta etapa.

### Opção B — Preparar banco remoto de homologação

Se o Preview precisar de banco e não existir um ambiente seguro, descreva os requisitos para criar um banco separado. Não crie recursos nem copie dados sem autorização.

### Opção C — Desabilitar Preview automático para esta branch

Se houver mecanismo seguro e documentado no projeto/Vercel, descreva-o. Não altere a configuração nesta etapa.

### Opção D — Prosseguir sem Preview, com revisão de PR e deploy controlado

Somente se o build local passar e houver uma forma comprovada de impedir acesso remoto indevido. Explique as perdas de validação dessa opção.

## 7. Preservar o ambiente local

- Após o build, o servidor local pode ser reiniciado com gate ligado para novos testes.
- Mantenha container, volume e bancos locais.
- Não remova dados fictícios.
- Não faça commit de arquivos temporários ou de ambiente.
- Confirme que os únicos arquivos não rastreados continuam sendo prompts locais já conhecidos.

## 8. Retorno esperado

Apresente:

1. resultado do teste runtime com gate desligado;
2. status HTTP da página e das principais APIs;
3. confirmação de que o gate ligado voltou a funcionar localmente;
4. resultado do `npm run build`;
5. confirmação de que o build usou somente banco local;
6. nomes dos projetos Vercel e integração Git, sem segredos;
7. matriz de segurança de Preview para IGH e INAC;
8. classificação final: push seguro ou bloqueado;
9. ação necessária antes do push;
10. `git status` final;
11. confirmação de que não houve push, PR, deploy, migration remota ou alteração de variável.

Não faça nenhuma mutação externa. Se houver dúvida sobre o banco utilizado por Preview, trate o push como bloqueado.
