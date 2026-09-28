# Prompt para o Cursor — Auditoria pré-push do Quadro de Atividades

O checkpoint do Quadro de Atividades foi criado no commit `02a275b`, na branch `feat/quadro-atividades-belem`. Antes de autorizar push, PR, preview ou migration, faça uma auditoria de ancestralidade da branch, conteúdo do commit e possibilidades seguras de homologação.

Esta etapa é prioritariamente de diagnóstico. **Não faça push, PR, deploy, migration, alteração no Vercel ou conexão com banco de produção.**

## 1. Auditar a base da branch

A branch `feat/quadro-atividades-belem` foi criada a partir de `feat/matriculas-e-turmas`. Precisamos saber se um futuro PR carregará alterações de matrículas e turmas junto com o Quadro de Atividades.

Inspecione, sem alterar o histórico:

- branch padrão/local que representa a base de produção;
- `merge-base` entre `feat/quadro-atividades-belem` e a branch principal;
- commits existentes na branch atual que não estão na principal;
- diferença completa entre a principal e a branch atual;
- quais commits pertencem a `feat/matriculas-e-turmas`;
- se o commit `02a275b` depende de modelos, migrations, componentes ou funções que existem somente em `feat/matriculas-e-turmas`;
- se `feat/matriculas-e-turmas` já foi integrada à branch principal ou se continua independente.

Use comandos de leitura como `git log`, `git merge-base`, `git diff --stat`, `git diff --name-status` e `git show`. Não execute rebase, reset, merge ou cherry-pick nesta primeira análise.

Classifique o cenário:

### Cenário A — Base já integrada

O PR pode usar a branch atual sem carregar trabalho extra.

### Cenário B — Quadro depende da branch de matrículas

O PR deverá apontar temporariamente para `feat/matriculas-e-turmas`, ou aguardar essa branch ser integrada antes de mudar a base.

### Cenário C — Quadro não depende da branch, mas herdou commits alheios

Será necessário criar uma branch limpa a partir da principal e aplicar somente o commit do quadro.

Não escolha silenciosamente. Informe o cenário e a evidência.

## 2. Auditar o conteúdo do commit

Revise `git show --name-status --stat 02a275b` e classifique os 33 arquivos em:

- código e testes do Quadro de Atividades;
- schema e migration;
- integração necessária com autenticação, usuários, menus e notificações;
- documentação técnica necessária;
- prompts ou documentos de trabalho que não são necessários para executar, manter ou implantar o sistema;
- arquivos possivelmente não relacionados.

O relatório afirma que “prompts Cursor” foram incluídos. Liste os caminhos exatos desses arquivos e informe:

- se o repositório já possui uma convenção explícita para versionar prompts de desenvolvimento;
- se eles são referenciados por código, testes ou documentação operacional;
- se contêm apenas histórico de trabalho;
- recomendação objetiva: manter no repositório ou retirar do commit antes do push.

Não altere nem amend o commit nesta etapa.

Confirme novamente que o commit não possui:

- `.env`;
- URLs de banco;
- IDs reais de unidade;
- tokens;
- credenciais;
- dados pessoais desnecessários.

## 3. Auditar compatibilidade da migration com a base correta

Compare o schema e o histórico de migrations da branch atual com a branch principal e com `feat/matriculas-e-turmas`.

Informe:

- se o número/nome da migration colide com outra migration;
- se a migration do quadro pressupõe alterações ainda não existentes na principal;
- se `PoloLocation`, `ClassSession`, notificações e usuários possuem o mesmo formato nas duas bases;
- se aplicar somente o commit `02a275b` em uma branch limpa seria suficiente;
- se haveria conflito de schema ou código em um eventual cherry-pick.

Não aplique a migration.

## 4. Verificar opções de homologação isolada

Não existe evidência de banco de teste dedicado. Investigue apenas a configuração local do projeto e informe as opções disponíveis, sem acessar dados de produção.

Verifique:

- existência de Docker Compose, scripts de banco local ou documentação de desenvolvimento;
- possibilidade de subir PostgreSQL local descartável;
- se todas as migrations atuais conseguem criar um banco vazio;
- existência de seed seguro para desenvolvimento;
- possibilidade de criar usuários, unidade, professor, turma e `ClassSession` mínimos para homologar o quadro;
- se o provedor de banco oferece branching/clonagem, apenas se isso já estiver documentado no projeto, sem acessar ou criar recursos externos;
- como o Vercel Preview escolhe as variáveis e por que ele não deve herdar banco de produção.

Apresente as opções na seguinte ordem de preferência:

1. banco PostgreSQL local descartável;
2. banco de homologação já existente;
3. branch/cópia isolada e autorizada do banco, sem dados pessoais desnecessários;
4. criação de um novo banco de homologação, somente após autorização.

Não recomende usar banco de produção em preview.

## 5. Verificar possibilidade de build sem risco

Informe:

- se `npm run build` pode ser executado localmente sem banco ativo;
- quais variáveis mínimas de build são exigidas;
- se o build realiza consultas externas ou migrations;
- se é possível executar o build com o gate desligado e valores fictícios seguros;
- se o build do Vercel Preview pode ocorrer antes de existir um banco de homologação.

Não rode build se ele puder se conectar ao banco de produção ou disparar efeitos externos. Se for comprovadamente local e sem efeitos, pode executá-lo; caso contrário, apenas documente o procedimento seguro.

## 6. Próxima ação recomendada

Com base nas evidências, recomende exatamente uma das opções:

- manter a branch atual e preparar o PR;
- aguardar a integração de `feat/matriculas-e-turmas`;
- criar uma branch limpa e fazer cherry-pick do commit `02a275b`;
- corrigir primeiro o conteúdo do commit.

Se a opção segura for criar uma branch limpa, apresente os comandos propostos, mas não os execute ainda.

Se prompts de desenvolvimento precisarem ser removidos, liste os arquivos e proponha um novo commit ou amend, mas não altere o histórico sem aprovação.

## 7. Retorno esperado

Entregue:

1. branch principal identificada;
2. cenário A, B ou C, com evidências;
3. commits herdados de `feat/matriculas-e-turmas`;
4. dependências reais do Quadro em relação a essa branch;
5. classificação dos 33 arquivos;
6. lista e recomendação sobre os prompts versionados;
7. compatibilidade da migration com a base principal;
8. opções reais de banco de homologação;
9. segurança do build local/preview;
10. próxima ação recomendada e respectivos comandos, sem executá-los.

Não faça push, PR, rebase, reset, merge, cherry-pick, amend, migration, deploy ou alteração externa.
