# Prompt para o Cursor — Homologação local do Quadro de Atividades

A branch limpa `feat/quadro-atividades-belem-clean`, commit `43db477`, está aprovada para homologação local. Prepare um ambiente descartável, aplique as migrations somente nesse ambiente e disponibilize o sistema para testes manuais do Quadro de Atividades.

**É proibido conectar, migrar ou alterar os bancos do IGH ou INAC. Não faça push, PR, deploy ou alteração no Vercel.**

## 1. Verificações iniciais

Antes de iniciar:

- confirme que a branch atual é `feat/quadro-atividades-belem-clean`;
- confirme que `HEAD` é `43db477` ou explique eventual novo commit local;
- execute `git status`;
- não adicione ao stage os prompts não rastreados em `docs/Prompt_Cursor_*`;
- identifique o sistema operacional e o shell utilizados;
- verifique se Docker está instalado e em execução;
- verifique se a porta local `55432` está livre;
- inspecione os scripts de banco e seed do projeto;
- inspecione o seed antes de executá-lo, confirmando se ele realiza somente operações no banco ou se possui efeitos externos, como e-mail, SMS, uploads ou chamadas de APIs.

Se Docker não estiver disponível, **não instale nada automaticamente**. Pare e informe as alternativas.

## 2. Proteção absoluta contra produção

Antes de qualquer comando Prisma que altere banco:

- crie variáveis específicas da sessão apontando somente para PostgreSQL local;
- confirme que o hostname efetivo é `127.0.0.1` ou `localhost`;
- confirme que a porta é `55432`;
- não reutilize `APP_DATABASE_URL`, `APP_DIRECT_URL`, `DATABASE_URL` ou `DIRECT_URL` existentes sem sobrescrevê-las no processo local;
- não exiba no relatório os valores das URLs existentes;
- não sobrescreva `.env`, `.env.local` ou arquivos pessoais já existentes;
- não copie dados de produção;
- não use dumps de IGH ou INAC.

Se qualquer comando resolver uma conexão que não seja local, interrompa imediatamente antes de migrar.

## 3. Criar PostgreSQL local descartável

Se Docker estiver disponível, crie um container com nome explícito, por exemplo:

`igh-board-activities-test-db`

Use:

- imagem oficial PostgreSQL compatível com o projeto, preferencialmente PostgreSQL 16 se não houver outra versão documentada;
- bind somente em `127.0.0.1`;
- porta externa `55432`;
- banco `igh_board_activities_test`;
- usuário local exclusivo;
- senha de teste local, não reutilizada e não versionada;
- volume Docker nomeado especificamente para essa homologação, sem reutilizar volume de outro projeto.

Antes de criar, confirme que não existe container ou volume com o mesmo nome. Não remova nem sobrescreva recursos existentes. Se já existirem, pare e informe.

Aguarde o healthcheck do PostgreSQL antes de prosseguir.

## 4. Configuração local do aplicativo

Descubra os nomes reais das variáveis de banco consumidas pelo Prisma e pelo aplicativo.

Configure apenas no processo/sessão local:

- URL principal apontando para o container local;
- URL direta apontando para o mesmo banco local;
- `BOARD_ACTIVITIES_ENABLED=true`;
- `BOARD_ACTIVITIES_POLO_LOCATION_ID` somente depois que a unidade fictícia for criada;
- segredo de autenticação exclusivamente local;
- marca/configuração mínima do IGH exigida pela aplicação;
- serviços externos desativados ou ausentes.

Prefira o mecanismo local já adotado pelo projeto. Se precisar criar um arquivo auxiliar de ambiente:

- use nome claramente local e ignorado pelo Git;
- não sobrescreva arquivos existentes;
- confirme que ele não está rastreado;
- não inclua credenciais de produção.

## 5. Aplicar as migrations no banco local

No banco local e somente nele:

1. execute `prisma migrate deploy` para aplicar todo o histórico de migrations;
2. confirme que `20260924150000_board_activities_mvp` foi aplicada;
3. execute `prisma migrate status`;
4. confirme que não há migrations pendentes;
5. valide a existência de `canCreateBoardTasks` e das quatro tabelas `BoardActivity*`.

Se uma migration antiga falhar ao construir um banco vazio:

- pare;
- preserve o container para diagnóstico;
- informe a migration, mensagem e contexto;
- não corrija com SQL manual;
- não marque migration como aplicada artificialmente.

## 6. Preparar dados fictícios mínimos

Primeiro avalie se o seed existente é seguro e suficiente.

Só execute o seed existente se:

- ele estiver apontando comprovadamente para o banco local;
- não enviar e-mails ou SMS;
- não chamar serviços externos;
- não depender de dados ou segredos de produção.

Se o seed não for seguro ou não criar os dados necessários, prepare dados fictícios locais pelo mecanismo mais simples e reversível, sem inserir informações reais de alunos ou profissionais.

Dados mínimos necessários:

- uma `PoloLocation` fictícia e ativa representando Belém — homologação;
- um usuário Master/Admin com permissão para acessar configurações;
- um usuário interno com `canCreateBoardTasks=true`;
- um professor inicialmente sem permissão de criação;
- um segundo profissional interno, para testar usuário terceiro;
- um estudante, para testar negação de acesso;
- curso e turma fictícios, se exigidos pelo modelo;
- professor relacionado conforme o modelo real;
- `ClassSession` no dia atual;
- duas sessões sobrepostas para o mesmo professor, permitindo testar alerta de conflito;
- uma sessão cancelada;
- nenhuma informação pessoal real.

Utilize senhas exclusivamente locais. Informe as credenciais de teste no retorno apenas como dados descartáveis de homologação.

Depois de criar a unidade, configure `BOARD_ACTIVITIES_POLO_LOCATION_ID` com o ID local dessa unidade. Não grave o ID no código nem em arquivo versionado.

## 7. Smoke tests de banco e APIs

Com o aplicativo apontando somente para o banco local, valide:

- gate desligado nega página e APIs;
- gate ligado com unidade válida libera o módulo;
- estudante recebe negação;
- usuário interno sem flag não cria;
- usuário com flag cria;
- Master/Admin habilita o professor pela interface/API;
- criador e responsável alteram o status;
- terceiro não altera status;
- comentário e reação são registrados;
- reação não duplica;
- histórico registra mudanças;
- filtros usam o fuso de Belém;
- agenda encontra sessões, cancelamento e conflito.

Não use chamadas externas. Se testes HTTP exigirem o servidor, execute-o localmente.

## 8. Executar o aplicativo local

Suba o sistema somente em interface local, preferencialmente:

`127.0.0.1:3000`

Antes de iniciar:

- confirme novamente que as URLs efetivas do processo apontam para `127.0.0.1:55432` ou `localhost:55432`;
- confirme que o gate está ativado somente nessa sessão;
- mantenha e-mail, SMS e integrações externas desativados;
- não exponha o servidor na rede pública.

Se a porta 3000 estiver ocupada, utilize outra porta local e informe.

Disponibilize:

- URL local de login;
- URL local `/gestao/atividades`;
- credenciais dos usuários fictícios;
- indicação do que testar com cada perfil.

Não mantenha processo oculto indefinidamente. Informe como iniciar e parar o servidor de forma controlada.

## 9. Roteiro manual de homologação

Prepare um checklist curto para o usuário executar no navegador:

1. Entrar como Admin e acessar o quadro.
2. Confirmar que “Hoje” é o filtro inicial.
3. Abrir **Quem pode criar atividades** e habilitar o professor.
4. Entrar como o professor e criar atividade com responsável e período.
5. Mover por arraste e por ação textual.
6. Entrar como responsável e mover a atividade.
7. Entrar como terceiro e confirmar que não consegue mover.
8. Comentar e reagir com usuários diferentes.
9. Testar Hoje, Amanhã, Esta semana e período personalizado.
10. Abrir Agenda dos professores e conferir sessão normal, cancelada e conflito.
11. Entrar como estudante e confirmar bloqueio.
12. Testar em largura de celular.

## 10. Build local

Com o banco local ativo e as variáveis locais confirmadas, avalie se há memória suficiente para executar `npm run build`.

- pode executar o build se ele estiver totalmente isolado;
- não execute se houver risco de OOM que comprometa o ambiente;
- se executar, registre sucesso ou erro;
- diferencie erros antigos de erros do Quadro;
- não altere código apenas para esconder problemas preexistentes.

## 11. Preservação e limpeza

Ao final desta etapa:

- não remova automaticamente o container ou o volume, pois o usuário ainda precisará homologar visualmente;
- informe os comandos exatos para parar e reiniciar o container;
- informe separadamente o comando de remoção futura do container e do volume, mas não o execute;
- não faça commit de dados, credenciais ou arquivos locais de ambiente;
- se algum script de seed específico for criado no repositório, não o versione sem aprovação;
- não faça push, PR, deploy ou migration externa.

## 12. Retorno esperado

Apresente:

1. confirmação de que todas as conexões usadas eram locais;
2. disponibilidade e versão do Docker/PostgreSQL;
3. container, porta e banco criados, sem expor segredos reutilizáveis;
4. resultado de todas as migrations e `migrate status`;
5. forma usada para criar os dados fictícios;
6. ID local da unidade apenas para configuração da sessão de homologação;
7. usuários fictícios e credenciais locais;
8. resultados dos smoke tests;
9. URL local e comandos para iniciar/parar o sistema;
10. checklist manual;
11. resultado do build, se executado;
12. `git status` final;
13. confirmação de que nenhum banco, deploy ou variável externa foi alterado.

Se não for possível montar o ambiente local com segurança, pare antes de qualquer migration e informe o bloqueio. Não utilize produção como alternativa.
