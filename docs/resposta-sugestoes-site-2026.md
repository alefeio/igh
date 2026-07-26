# Resposta às Sugestões de Melhoria para o Site — 2026

Retorno técnico ao documento **"Sugestões de Melhoria para o Site — Visão do Administrator"**.

Agradecemos as observações: elas são precisas e cobrem exatamente os pontos de maior uso diário do sistema. Ao revisar item a item contra a versão atual em produção, identificamos que **parte das sugestões já foi implementada** em atualizações recentes — provavelmente posteriores à análise que originou o documento. Este retorno serve para alinhar o que já existe, o que falta e quais decisões precisamos do Instituto antes de começar.

## Resumo

| # | Sugestão | Situação |
|---|---|---|
| 1 | Professores: identificação por polo e unidade | A fazer |
| 2 | Alunos: filtros por ciclo de atendimento | A fazer |
| 3 | Quadro de horários: visão semanal e Excel | A fazer |
| 4 | Menu lateral: seção Pedagógico | **Já implementado** |
| 5 | Permissões: Comunicação e Site só para Master | Comunicação **já está restrita**; Site precisa de decisão |
| 6 | Perfil do aluno: banner e conteúdo condicional | **Já implementado** — confirmar detalhe |
| 7 | Página inicial: destaque do novo ciclo | Já é editável pelo Master — confirmar botões |
| 8 | Inscreva-se: reduzir elementos antes dos cursos | Em grande parte já feito — confirmar com print |
| 9 | Inscreva-se: cursos em cards por polo | **Já implementado** — confirmar detalhe |

---

## 01 — Professores: identificação por polo e unidade

**Situação atual.** A tabela *Corpo docente* (`/teachers`) tem as colunas Foto, Nome, Contato, Status e Ações. O único filtro é por situação (Ativos / Inativos / Todos). Não há coluna nem filtro de polo.

No banco, o cadastro do professor **não guarda polo ou unidade**. Hoje o local aparece apenas na turma: cada turma aponta para uma unidade (`PoloLocation`), que por sua vez pertence a um polo. Ou seja, só é possível saber onde um professor atua olhando as turmas que ele leciona.

**O que faremos.** Criar um vínculo direto entre professor e unidade, permitindo mais de uma unidade por professor, como o documento pede. O preenchimento inicial será feito automaticamente a partir das turmas já cadastradas, para ninguém precisar redigitar. Em seguida, entram a coluna Polo/Unidade na tabela, o filtro e a ordenação.

**Precisamos confirmar.** Os exemplos do documento usam o formato *"Belém | Unidade 14 de Abril"* e *"Acará | E. M. Francisco Pinto"*, ou seja **município | unidade**. No sistema atual, o cadastro de Polo tem apenas um nome livre e não guarda município separadamente. Pergunta: o "polo" hoje cadastrado corresponde ao município? Se sim, exibimos o nome do polo à esquerda; se não, precisamos incluir o campo município no cadastro de polos.

---

## 02 — Alunos: filtros por ciclo de atendimento

**Situação atual.** A página `/alunos` tem apenas busca por nome/CPF, opção de incluir excluídos e paginação. O painel *Público-alvo (perfil geral)* existe e mostra sexo, faixa etária, bairro, cidade, escolaridade e turno — mas hoje ele é calculado **sobre toda a base ativa e ignora os filtros da tela de propósito**.

O ciclo já existe como cadastro próprio no sistema (Ciclo 1/2026, Ciclo 2/2026 etc.) e está ligado à turma. O aluno se conecta ao ciclo através da matrícula, então o filtro é tecnicamente viável.

**O que faremos.** Adicionar o filtro de ciclo e alterar o painel de perfil geral para respeitar os filtros ativos, como o documento pede. Como a lista de alunos é paginada, a filtragem será feita no servidor, e não na tela, para que a contagem e a paginação fiquem corretas.

**Precisamos confirmar.**

1. **"Situação"** significa a situação da *matrícula* (ativa, suspensa, concluída) ou a do *aluno* no cadastro (ativo, excluído)?
2. **"Período"** significa o intervalo de datas da matrícula ou o turno das aulas (manhã, tarde, noite)?
3. Um aluno matriculado em turmas de **dois ciclos diferentes** deve aparecer nos dois filtros. Confirma esse comportamento?

---

## 03 — Quadro de horários: visão semanal completa e exportável

**Situação atual.** O quadro (`/horarios`) é uma tabela corrida, com uma linha por turma, ordenada por curso: Curso, Dias da semana, Horário, Professor, Local, Início e Término. A exportação em PDF funciona pela janela de impressão do navegador ("Salvar como PDF"). Não há filtros nem exportação em Excel.

**Boa notícia.** Todos os dados que o documento pede — ciclo, professor, curso, polo/unidade, início da turma e total de alunos matriculados — **já são entregues pelo sistema** nessa tela; só não são exibidos. Isso significa que a reformulação é de apresentação, sem mexer na base de dados, o que reduz bastante o risco. O sistema também já usa Excel em outros relatórios, então a exportação nova aproveita a estrutura existente.

**O que faremos.** Reorganizar em grade semanal agrupada por professor, com as colunas pedidas, mais os filtros por ciclo, professor, curso e polo, e a exportação em Excel. Manteremos a exportação em PDF ajustando o layout para paisagem, que é o formato adequado para uma grade semanal impressa.

**Precisamos confirmar.**

1. **Intervalos não existem no sistema hoje.** Não há onde registrar o intervalo de uma turma. Ele é fixo por turno (por exemplo, sempre 15 minutos no meio da aula) ou varia por turma e precisa virar um campo novo no cadastro?
2. O documento cita um **"cronograma de referência"** mostrado em imagem. Podem nos enviar esse arquivo (Excel ou PDF)? Queremos reproduzir o layout que o Instituto já usa, em vez de propor um novo.
3. **Total de alunos** deve contar apenas matrículas ativas ou incluir suspensas e concluídas?

---

## 04 — Menu lateral: criação da seção Pedagógico

**Esta sugestão já está implementada.** O menu lateral já possui a seção **Pedagógico**, com exatamente os itens propostos: Professores, Alunos, Cursos, Planos de aula, Turmas, Polos, Matrículas, Quadro de horários e Frequência.

A seção **Administração** também já ficou com o perfil de governança sugerido: Visão da plataforma, Calendário institucional, Guia do sistema, Acessos, Avaliações de experiência, Inscrições em eventos, Gamificação e Ranking.

**Ponto para avaliação.** Além desses, Administração hoje também concentra Usuários, Aprovações do site, Formações (catálogo), moderação da Comunidade e Fóruns. São itens de governança e controle, então nos parecem bem posicionados — mas, se a preferência for mover Formações e Fóruns para o Pedagógico, a mudança é simples. Ficamos no aguardo.

---

## 05 — Permissões: Comunicação e Site somente para o perfil Master

Este é o item que mais precisa de conversa, porque envolve um mecanismo que talvez não estivesse visível na análise.

**Comunicação já está restrita ao Master.** Campanhas de SMS, de e-mail e campanhas do site/alunos são exclusivas do perfil Master em todas as camadas: não aparecem no menu, o acesso pela URL é bloqueado e as operações são recusadas pelo servidor. Nenhum Administrador ou coordenador consegue disparar comunicação hoje. **Nada a fazer neste ponto.**

**Site funciona com fila de aprovação.** A área Site é visível para Administrador e Coordenador, mas eles **não publicam nada diretamente**. Toda alteração feita por esses perfis vira uma solicitação pendente, e o conteúdo público só muda depois que o **Master aprova** na tela *Aprovações do site*, onde é possível ver exatamente o que muda, campo por campo, e rejeitar se for o caso. O coordenador de polo já não tem nenhum acesso à área Site.

Ou seja, o objetivo declarado no documento — *"evitar alterações indevidas em conteúdos públicos e configurações críticas"* — **já está atendido**, com a vantagem de o Master continuar recebendo ajuda operacional na alimentação do site sem perder o controle editorial.

**Decisão necessária.** Diante do exposto, o Instituto prefere:

- **(a)** Manter o modelo atual — Administrador e Coordenador colaboram, Master aprova tudo; ou
- **(b)** Bloquear totalmente a área Site para Administrador e Coordenador, deixando-a exclusiva do Master.

Registramos que a opção (b) é simples de implementar, mas desativa na prática a fila de aprovação e transfere ao Master toda a alimentação do site (banners, notícias, projetos, depoimentos, unidades, FAQ, transparência etc.).

---

## 06 — Perfil do aluno: banner de inscrições e conteúdo condicional

**Esta sugestão já está implementada.** O aluno **sem matrícula** vê hoje, logo no topo do painel, um banner de destaque com o selo *Novo ciclo*, o título **"Inscrições abertas para o novo ciclo"**, a quantidade de turmas com vaga disponível e o botão **Inscreva-se**, que leva direto para a página de cursos e turmas. Quando não há turma aberta, o mesmo espaço informa *"Inscrições do novo ciclo em breve"*, sem botão, para não gerar frustração.

A regra de exibição condicional também já funciona como descrito: blocos de progresso, "Continuar de onde parou", lista de cursos e atalhos de turma aparecem **somente para quem tem matrícula**. O bloco *"Sua jornada começa em breve"* nunca é exibido para aluno sem matrícula — ele só aparece em um caso específico, quando o aluno tem matrícula mas ela está suspensa.

**Precisamos confirmar.** O documento sugere *"substituir ou complementar"* o bloco "Olá, {nome}". Hoje ele **complementa**: a saudação continua no topo e o banner de inscrição vem logo abaixo. Preferem manter assim ou ocultar a saudação para o aluno sem matrícula, deixando o banner sozinho no topo?

---

## 07 — Página inicial: destaque para o novo ciclo

**Situação atual.** O banner principal da home **já é totalmente editável pelo Master**, sem depender de programação: título, subtítulo, imagem, texto do botão e destino do botão são configurados em *Site → Banners*. É possível ter vários banners em carrossel e ativar ou desativar cada um. O botão padrão já é **Inscreva-se**, apontando para a página de inscrições.

Na prática, o pedido *"o conteúdo do banner deve ser facilmente atualizável pelo Master a cada ciclo"* **já está atendido** — o que falta é preencher o conteúdo do novo ciclo (período, início das aulas, cursos em destaque), o que pode ser feito pelo próprio Instituto. Podemos cadastrar junto na primeira vez, se preferirem.

**Precisamos confirmar os botões.** Há uma divergência entre o documento e o que encontramos no site:

- **"Começar agora"** existe, mas fica na **barra de navegação do topo**, não no banner. Já leva para a página de inscrições. Renomear para *Inscreva-se* é imediato.
- **"Ver formações"** não existe com esse nome. Os botões parecidos são *Ver catálogo* e *Ver todas as formações*, em blocos diferentes da página, e ainda há um campo de busca de cursos dentro do próprio banner.

Para não remover o elemento errado, pedimos **um print da tela com o botão circulado**.

---

## 08 — Página de inscrições: reduzir elementos antes da lista de cursos

**Situação atual.** Boa parte desta sugestão já foi aplicada. O bloco **Seus dados** já não fica no topo: ele aparece **no fim da página, recolhido**, e só para alunos já identificados. A sequência atual da tela é exatamente a recomendada pelo documento: cabeçalho curto → filtros → cards de cursos e turmas → resumo da seleção e envio → dados pessoais apenas quando necessários.

O cabeçalho superior também já usa a versão reduzida, mais baixa que a das outras páginas do site.

**Precisamos confirmar.** Se ainda assim o topo estiver ocupando espaço demais na tela usada pelo Instituto, há duas saídas, e queremos saber qual preferem: o Master **remover a imagem de fundo** do cabeçalho em *Site → Página Inscreva-se* (o cabeçalho encolhe bastante e não exige programação), ou nós reduzirmos ainda mais o espaçamento. Um print da tela como ela aparece hoje para vocês ajudaria a decidir.

---

## 09 — Página de inscrições: cursos em cards separados por polo

**Esta sugestão já está implementada.** A lista foi substituída por **cards em grade**, dois por linha em telas médias e três em telas grandes, **agrupados por unidade**, com o nome do polo ao lado do título de cada grupo e a contagem de turmas.

Cada card já mostra o nome do curso, a descrição curta, os dias da semana, o horário, a data de início, a **situação das vagas** (com avisos de *Última vaga* e *Sem vagas*) e o botão **Selecionar**, que muda para *Selecionada* quando escolhido. Há ainda busca por curso e um filtro de unidade acima dos cards.

Os comportamentos pedidos também já funcionam: é possível escolher **mais de um curso**, turmas no mesmo dia e horário são **bloqueadas com aviso**, e a quantidade selecionada aparece na barra de resumo antes do envio.

**Precisamos confirmar.**

1. O polo/unidade hoje aparece como **título da seção** que agrupa os cards, e não repetido dentro de cada card. Está adequado ou preferem também dentro do card?
2. Existe hoje um **limite de 2 turmas** por inscrição. Esse limite está correto para o novo ciclo?

---

## Decisões pendentes

Para começarmos, precisamos de retorno nos seguintes pontos:

1. **Item 05:** manter a fila de aprovação (opção a) ou bloquear a área Site para Administrador e Coordenador (opção b).
2. **Item 01:** o polo cadastrado corresponde ao município ou é preciso criar o campo município.
3. **Item 02:** o que significam "situação" e "período" na lista de filtros.
4. **Item 03:** como tratar os intervalos e envio do cronograma de referência usado como modelo.
5. **Itens 07 e 08:** prints das telas com os pontos a ajustar.
6. **Itens 06 e 09:** confirmação dos detalhes finais apontados acima.

## Ordem de execução proposta

Sugerimos executar em quatro etapas, entregando cada uma para validação antes de seguir:

1. **Ajustes rápidos e conteúdo** — itens 07, 08 e os acertos finais de 06 e 09. Sem mudança na base de dados, com resultado visível de imediato.
2. **Permissões** — item 05, assim que a decisão for tomada.
3. **Cadastros e filtros** — itens 01 e 02, que envolvem mudanças na base de dados e serão feitos com preenchimento automático a partir dos dados já existentes.
4. **Quadro de horários** — item 03, o mais extenso, executado por último e com o cronograma de referência em mãos.

Cada etapa será entregue separadamente, para que o Instituto valide aos poucos e possamos corrigir o rumo sem retrabalho.
