import type { UserRole } from "../../src/generated/prisma/client";

/**
 * Conteúdo padrão do guia "Como usar o sistema", um documento por perfil.
 *
 * Os textos descrevem o menu real de cada perfil (ver `src/components/layout/Sidebar.tsx`)
 * e as regras de acesso aplicadas em `src/proxy.ts`. Ao mudar permissões ou itens de menu,
 * atualize o guia correspondente aqui e republique com `npm run seed:onboarding`.
 *
 * Títulos alinhados a `DEFAULT_TITLE` em `src/app/api/onboarding/route.ts`.
 */
export const ONBOARDING_GUIDES: Record<UserRole, { title: string; contentRich: string }> = {
  MASTER: {
    title: "Como usar o sistema — Master",
    contentRich: `<h2>Visão geral do perfil Master</h2>
<p>O <strong>Master</strong> é o único perfil com alcance total: além de toda a operação pedagógica e do site, responde pelas decisões que não têm volta — contas de usuário, publicação de conteúdo público, disparos em massa e backup do banco. Use o <strong>menu à esquerda</strong> como mapa; o que você vê nele é exatamente o que o seu perfil pode acessar.</p>
<p>Duas responsabilidades são exclusivamente suas e ninguém mais consegue executar: <strong>aprovar as alterações do site</strong> feitas pelo Administrador e <strong>gerenciar usuários</strong>.</p>

<h2>Início</h2>
<h3>Página Inicial</h3>
<p>Resumo da operação com indicadores, atalhos e avisos. Ponto de partida após o login.</p>
<h3>Como usar o sistema</h3>
<p>Esta página. Cada perfil enxerga um guia diferente; Master e Administrador editam todos eles em <strong>Guia do sistema (edição)</strong>.</p>
<h3>Coordenação</h3>
<p>Fila de <strong>reportes</strong> abertos por professores e equipe: mensagens, anexos e status até o encerramento. Mantenha o histórico no próprio chamado para haver rastreabilidade.</p>

<h2>Pedagógico</h2>
<h3>Professores</h3>
<p>Cadastro do corpo docente. A coluna <strong>Polo/Unidade</strong> não é um campo do cadastro: ela mostra onde o professor atua hoje, deduzido das turmas em curso no ciclo atual. Quem não tem turma no ciclo aparece como "Sem turma no ciclo atual". Use o filtro no topo para ver o quadro de um polo específico.</p>
<h3>Alunos</h3>
<p>Base de estudantes. A tela abre mostrando apenas quem tem <strong>matrícula ativa no ciclo atual</strong>. Nos filtros há um checkbox por ciclo e a opção <strong>Todos</strong> — marque o que precisar. Os indicadores de perfil geral (gênero, faixa etária, bairro, escolaridade) acompanham o mesmo recorte, assim como a exportação.</p>
<h3>Cursos</h3>
<p>Estrutura pedagógica: cursos, módulos, aulas, materiais e requisitos.</p>
<h3>Planos de aula (PDF)</h3>
<p>Planos de aula publicados para consulta e download.</p>
<h3>Turmas</h3>
<p>Ofertas: curso, professores (titular e adicionais), ciclo, calendário, vagas, status e local. O <strong>local do polo</strong> definido aqui é o que alimenta o polo do professor e o quadro de horários.</p>
<h3>Polos</h3>
<p>Polos e suas unidades, além do coordenador de polo responsável por cada local.</p>
<h3>Matrículas</h3>
<p>Inclusão, alteração e situação das matrículas, com exportação em Excel e PDF.</p>
<h3>Quadro de horários</h3>
<p>Grade semanal <strong>separada por professor</strong>, abrindo no ciclo atual. Cada linha traz curso, dias, horário, polo/unidade, início da turma e total de alunos. Filtre por ciclo, professor, curso ou polo e exporte em <strong>Excel</strong> ou em PDF para afixar no instituto.</p>
<h3>Frequência — todas as turmas</h3>
<p>Consolidado de presença de todas as turmas.</p>

<h2>Administração</h2>
<h3>Visão da plataforma</h3>
<p>Indicadores gerais de uso e saúde da operação.</p>
<h3>Calendário institucional</h3>
<p>Datas que afetam o calendário de aulas.</p>
<h3>Guia do sistema (edição)</h3>
<p>Edição destes textos por perfil, com rich text e imagens. O que você salva aqui é o que cada tipo de usuário lê em <strong>Como usar o sistema</strong>.</p>
<h3>Usuários</h3>
<p><strong>Exclusivo do Master.</strong> Criação, edição e desativação de contas e perfis. Nem o Administrador tem acesso.</p>
<h3>Acessos ao sistema</h3>
<p>Auditoria de quem entrou e quando.</p>
<h3>Aprovações do site</h3>
<p><strong>Exclusivo do Master.</strong> Toda alteração de conteúdo do site feita pelo Administrador fica parada aqui até você aprovar ou rejeitar. Enquanto não for aprovada, nada muda no site público. Revise esta fila com regularidade — é ela que segura as publicações.</p>
<h3>Formações (catálogo)</h3>
<p>Catálogo de formações usado pelo site e pelas inscrições.</p>
<h3>Comunidade IGH — moderação e Comunidade IGH (PII)</h3>
<p>Moderação das publicações da comunidade e a visão com dados pessoais dos participantes.</p>
<h3>Fóruns — todos os cursos</h3>
<p>Visão transversal dos fóruns: tópicos, participação e moderação.</p>
<h3>Avaliações de experiência</h3>
<p>Feedbacks dos alunos reunidos para análise pedagógica.</p>
<h3>Inscrições em eventos</h3>
<p>Eventos institucionais e a lista de inscritos.</p>
<h3>Gamificação e Ranking dos alunos</h3>
<p>Regras de pontuação, níveis e o ranking apresentado aos alunos e professores.</p>

<h2>Comunicação</h2>
<p><strong>Exclusiva do Master</strong>, porque o disparo é irreversível: <strong>Campanhas SMS</strong>, <strong>Campanhas de e-mail</strong> e <strong>Campanhas (site e alunos)</strong>. Confira público, mensagem e base legal (LGPD) antes de enviar.</p>

<h2>Site</h2>
<p>CMS do site público e dos banners do aluno: configurações gerais, menu, banners, mensagens de contato, páginas (Contato, Sobre, Espaço Maker, Formações, Inscreva-se), projetos, notícias, depoimentos, parceiros, unidades, FAQ, termos e privacidade e transparência.</p>
<p>Quando <strong>você</strong> salva, a alteração vai direto para o ar. Quando o <strong>Administrador</strong> salva, ela entra na fila de <strong>Aprovações do site</strong> e só é publicada depois do seu aval.</p>

<h2>Configurações</h2>
<p><strong>Exclusivas do Master.</strong></p>
<ul>
<li><strong>Horários (cadastro)</strong> — blocos de horário reutilizados na montagem das turmas.</li>
<li><strong>Backup do banco</strong> — operação crítica; execute em janela segura.</li>
</ul>

<h2>Boas práticas</h2>
<ul>
<li>Trate a fila de aprovações como parte da rotina: alteração parada é conteúdo desatualizado no site.</li>
<li>Faça mudanças em produção em janelas de menor uso e registre o que foi feito.</li>
<li>Use contas pessoais e auditáveis; não compartilhe credenciais.</li>
<li>Trate dados pessoais conforme a LGPD e a política interna.</li>
</ul>`,
  },

  ADMIN: {
    title: "Como usar o sistema — Administrador",
    contentRich: `<h2>Visão geral do perfil Administrador</h2>
<p>O <strong>Administrador</strong> toca o dia a dia inteiro da plataforma: pedagógico, governança e conteúdo do site. A diferença em relação ao Master está em dois pontos: o que você altera no <strong>site</strong> passa por aprovação, e algumas operações permanecem fora do seu alcance.</p>
<p><strong>Fica só com o Master:</strong> Usuários, Aprovações do site, Campanhas (SMS, e-mail e site/alunos), Horários (cadastro) e Backup do banco. Se precisar de algo nessas áreas, peça ao Master.</p>

<h2>Como funciona a aprovação do site</h2>
<p>Ao salvar qualquer conteúdo da seção <strong>Site</strong>, a alteração <strong>não vai direto para o ar</strong>: ela entra numa fila e o Master aprova ou rejeita. A mensagem de confirmação na tela avisa quando a alteração ficou pendente — se ela disser que está aguardando aprovação, o site público só muda depois do aval. Isso vale para todas as telas do CMS, inclusive exclusões.</p>

<h2>Início</h2>
<h3>Página Inicial</h3>
<p>Visão geral, indicadores e atalhos da rotina administrativa.</p>
<h3>Como usar o sistema</h3>
<p>Esta página. Você e o Master editam os guias de todos os perfis em <strong>Guia do sistema (edição)</strong>.</p>
<h3>Coordenação</h3>
<p>Acompanhamento dos <strong>reportes</strong> abertos por professores e equipe, com mensagens, anexos e status até a conclusão.</p>

<h2>Pedagógico</h2>
<h3>Professores</h3>
<p>Cadastro do corpo docente. A coluna <strong>Polo/Unidade</strong> mostra onde o professor atua hoje, deduzido das turmas em curso no ciclo atual — não é um campo preenchido à mão. Para mudar o polo de um professor, mude o local da turma dele.</p>
<h3>Alunos</h3>
<p>A tela abre com apenas os alunos de <strong>matrícula ativa no ciclo atual</strong>. Use os checkboxes de ciclo, ou <strong>Todos</strong>, para ampliar o recorte. Os indicadores de perfil geral e a exportação seguem o mesmo filtro.</p>
<h3>Cursos e Planos de aula (PDF)</h3>
<p>Estrutura de cursos, módulos, aulas e materiais, além dos planos de aula publicados.</p>
<h3>Turmas</h3>
<p>Ofertas, professores, ciclo, calendário, vagas, status e local. O local do polo informado aqui alimenta o quadro de horários e o polo exibido no cadastro de professores.</p>
<h3>Polos</h3>
<p>Polos, unidades e o coordenador de polo de cada local.</p>
<h3>Matrículas</h3>
<p>Gestão das matrículas nas turmas, com exportação em Excel e PDF.</p>
<h3>Quadro de horários</h3>
<p>Grade semanal <strong>por professor</strong>, no ciclo atual, com curso, dias, horário, polo/unidade, início da turma e total de alunos. Filtros por ciclo, professor, curso e polo, com exportação em <strong>Excel</strong> e em PDF.</p>
<h3>Frequência — todas as turmas</h3>
<p>Consolidado de presença de todas as turmas.</p>

<h2>Administração</h2>
<p>Visão da plataforma, Calendário institucional, Guia do sistema (edição), Acessos ao sistema, Formações (catálogo), Comunidade IGH (moderação e visão com dados pessoais), Fóruns de todos os cursos, Avaliações de experiência, Inscrições em eventos, Gamificação e Ranking dos alunos.</p>

<h2>Site</h2>
<p>Todo o CMS do site público e dos banners do aluno: configurações gerais, menu, banners, mensagens de contato, páginas institucionais, projetos, notícias, depoimentos, parceiros, unidades, FAQ, termos e privacidade e transparência. Lembre-se de que cada salvamento entra na fila de aprovação do Master.</p>

<h2>Boas práticas</h2>
<ul>
<li>Depois de editar o site, avise o Master de que há itens aguardando aprovação — sem o aval dele nada é publicado.</li>
<li>Documente mudanças relevantes em conteúdo público.</li>
<li>Confira os dados antes de alterar matrículas e turmas em andamento.</li>
<li>Encerre a sessão em computadores compartilhados.</li>
</ul>`,
  },

  COORDINATOR: {
    title: "Como usar o sistema — Coordenador",
    contentRich: `<h2>Visão geral do perfil Coordenador</h2>
<p>O <strong>Coordenador</strong> responde pela <strong>coordenação pedagógica</strong>: professores, alunos, cursos, turmas, polos, matrículas, horários e frequência. O menu foi desenhado para isso — você tem a visão mais completa possível do que acontece nas turmas, sem as áreas de governança da plataforma.</p>
<p><strong>Não fazem parte deste perfil</strong> as seções de Administração, Site e Configurações: conteúdo do site, contas de usuário, campanhas, gamificação, ranking, backup e cadastros globais ficam com o Administrador e o Master. Se precisar de algo nessas áreas, acione a equipe.</p>

<h2>Início</h2>
<h3>Página Inicial</h3>
<p>Resumo da operação com indicadores e atalhos para acompanhar o andamento das turmas.</p>
<h3>Como usar o sistema</h3>
<p>Esta página. Os textos são mantidos por Master ou Administrador; se algo não bater com a sua tela, peça a atualização.</p>
<h3>Coordenação</h3>
<p>Área central de <strong>reportes</strong>: professores e equipe abrem chamados, você responde, anexa arquivos e acompanha até o fechamento. Mantenha o histórico no próprio chamado.</p>

<h2>Pedagógico</h2>
<h3>Professores</h3>
<p>Cadastro do corpo docente. A coluna <strong>Polo/Unidade</strong> mostra onde cada professor está atuando agora, deduzida das turmas em curso no ciclo atual — não é um campo digitado. Quem não tem turma no ciclo aparece como "Sem turma no ciclo atual". O filtro no topo permite ver o quadro de um polo específico.</p>
<h3>Alunos</h3>
<p>A tela abre com apenas os alunos de <strong>matrícula ativa no ciclo atual</strong>, que é a leitura mais útil no dia a dia. Nos filtros há um checkbox por ciclo e a opção <strong>Todos</strong>, para consultar histórico. Os indicadores de perfil geral — gênero, faixa etária, bairro, cidade, escolaridade e turno de estudo — acompanham o recorte escolhido, e a exportação em Excel ou PDF sai com os mesmos alunos que estão na tela.</p>
<h3>Cursos</h3>
<p>Estrutura pedagógica: cursos, módulos, aulas e materiais.</p>
<h3>Planos de aula (PDF)</h3>
<p>Planos de aula publicados, para consulta e acompanhamento do que está sendo trabalhado em sala.</p>
<h3>Turmas</h3>
<p>Ofertas do período: curso, professor titular e adicionais, ciclo, dias e horários, vagas, status e local do polo. É aqui que se define o local que aparece no quadro de horários e no cadastro dos professores.</p>
<h3>Polos</h3>
<p>Polos, unidades e coordenadores de polo.</p>
<h3>Matrículas</h3>
<p>Inclusão, alteração e situação das matrículas, com o número de alunos por turma e exportação em Excel e PDF. É a visão principal para acompanhar quantos alunos estão matriculados e como as turmas estão preenchidas.</p>
<h3>Quadro de horários</h3>
<p>Grade semanal <strong>separada por professor</strong>, abrindo no ciclo atual. Cada linha traz curso, dias, horário, polo/unidade, início da turma e total de alunos, com total de turmas e de alunos por professor. Filtre por ciclo, professor, curso ou polo e exporte em <strong>Excel</strong> ou em PDF. Use para conferir carga horária, sobreposição de horários e distribuição entre os polos.</p>
<h3>Frequência — todas as turmas</h3>
<p>Consolidado de presença de todas as turmas, para identificar evasão e turmas com baixa frequência.</p>

<h2>Boas práticas</h2>
<ul>
<li>Confira o local do polo ao criar turmas: ele alimenta o quadro de horários e o polo do professor.</li>
<li>Ao analisar números de alunos, verifique qual ciclo está marcado no filtro — o padrão é só o ciclo atual.</li>
<li>Alinhe decisões acadêmicas sensíveis (certificação, políticas) com a direção.</li>
<li>Proteja senhas e dados dos alunos (LGPD) e encerre a sessão em equipamentos compartilhados.</li>
</ul>`,
  },

  POLO_COORDINATOR: {
    title: "Como usar o sistema — Coordenador de Polos",
    contentRich: `<h2>Visão geral do perfil Coordenador de Polos</h2>
<p>Como <strong>Coordenador de Polos</strong>, você cuida das <strong>matrículas</strong> das turmas vinculadas aos polos sob sua responsabilidade. O menu é enxuto de propósito: Página Inicial, este guia e <strong>Matrículas</strong>.</p>

<h2>Início</h2>
<h3>Página Inicial</h3>
<p>Ao entrar, você é direcionado para a área de matrículas do seu escopo.</p>
<h3>Como usar o sistema</h3>
<p>Esta página, específica do seu perfil.</p>

<h2>Matrículas dos seus polos</h2>
<h3>O que você vê</h3>
<p>Somente turmas ligadas a um <strong>local de polo</strong> que você coordena. Turmas sem vínculo com polo, ou de outros polos, não aparecem para você.</p>
<h3>O que você pode fazer</h3>
<ul>
<li>Listar matrículas ativas e pré-matrículas das suas turmas.</li>
<li>Cadastrar um aluno novo e matriculá-lo, respeitando status e vagas da turma.</li>
<li>Atualizar a situação da matrícula e mover o aluno entre turmas do seu escopo.</li>
</ul>
<h3>O que fica com a administração</h3>
<p>Cadastro de polos e unidades, definição do coordenador de cada local, criação de turmas e vínculo entre turma e local são feitos por <strong>Coordenador</strong>, <strong>Administrador</strong> ou <strong>Master</strong>. Se uma turma sua não aparece, provavelmente falta vincular o local do polo a ela — peça o ajuste.</p>

<h2>Boas práticas</h2>
<ul>
<li>Confirme o local do polo da turma antes de matricular.</li>
<li>Mantenha os dados de contato do aluno atualizados junto à secretaria.</li>
<li>Encerre a sessão em equipamentos compartilhados.</li>
</ul>`,
  },

  TEACHER: {
    title: "Como usar o sistema — Professor",
    contentRich: `<h2>Visão geral do perfil Professor</h2>
<p>Como <strong>Professor</strong>, seu menu reúne o que você precisa para conduzir as turmas que leciona: conteúdo e aulas, calendário, frequência, eventos, fórum, comunidade, gamificação e as avaliações de experiência dos seus alunos. Você também consulta <strong>Cursos</strong> e <strong>Alunos</strong>, e abre chamados em <strong>Coordenação</strong>.</p>

<h2>Início</h2>
<h3>Página Inicial</h3>
<p>Resumo, avisos e atalhos para suas turmas e tarefas do dia.</p>
<h3>Como usar o sistema</h3>
<p>Esta página.</p>
<h3>Coordenação</h3>
<p>Envie <strong>reportes</strong> à coordenação — dúvidas, solicitações, problemas em sala — com anexos quando necessário. Acompanhe a resposta no mesmo chamado para não perder o contexto.</p>

<h2>Professor</h2>
<h3>Turmas que leciono</h3>
<p>Suas turmas, com informações da oferta e acesso ao <strong>conteúdo do curso</strong> (módulos e aulas), incluindo o modo de apresentação da aula quando disponível.</p>
<h3>Acompanhamento</h3>
<p>Evolução dos alunos das suas turmas, para identificar quem está ficando para trás.</p>
<h3>Calendário de aulas</h3>
<p>Suas aulas na linha do tempo, com datas e horários já considerando o calendário institucional.</p>
<h3>Comunidade IGH (PII)</h3>
<p>Espaço de publicações da comunidade do instituto.</p>
<h3>Fórum dos cursos</h3>
<p>Fórum dos cursos em que você atua: responda tópicos e oriente os alunos.</p>
<h3>Eventos (presença)</h3>
<p>Registro de presença nos eventos institucionais em que sua turma participa.</p>
<h3>Frequência</h3>
<p>Chamada das suas turmas: lançamento e consulta de presença e justificativas.</p>
<h3>Gamificação e Ranking dos alunos</h3>
<p>Pontuação, níveis e o ranking dos alunos — útil para alinhar a dinâmica de sala e reconhecer o engajamento.</p>
<h3>Avaliações de experiência</h3>
<p>Feedbacks dos alunos das turmas em que você leciona, para ajustar didática e comunicação.</p>

<h2>Consulta</h2>
<h3>Cursos</h3>
<p>Estrutura dos cursos em que você está vinculado.</p>
<h3>Alunos</h3>
<p>Consulta dos alunos das suas turmas. Respeite a privacidade e use apenas com finalidade pedagógica.</p>

<h2>O que fica com a administração</h2>
<p>Matrículas, cadastro de turmas e professores, conteúdo do site, campanhas e configurações são responsabilidade da <strong>Coordenação</strong>, do <strong>Administrador</strong> ou do <strong>Master</strong>. A edição deste guia é feita por Master ou Administrador.</p>

<h2>Boas práticas</h2>
<ul>
<li>Publique materiais e prazos com antecedência.</li>
<li>Lance a frequência no dia da aula, enquanto a informação está fresca.</li>
<li>Use o fórum ou a Coordenação conforme o canal oficial da escola.</li>
<li>Encerre a sessão em equipamentos compartilhados.</li>
</ul>`,
  },

  STUDENT: {
    title: "Como usar o sistema — Aluno",
    contentRich: `<h2>Visão geral do portal do aluno</h2>
<p>O portal reúne o que você precisa para estudar: suas <strong>turmas</strong> e o conteúdo dos cursos, seu <strong>calendário de aulas</strong>, sua <strong>evolução e o ranking</strong>, a <strong>comunidade</strong> do instituto e o <strong>fórum</strong> dos cursos. Use o menu à esquerda para navegar.</p>

<h2>Início</h2>
<h3>Página Inicial</h3>
<p>Painel com avisos, atalhos e o resumo do seu progresso.</p>
<h3>Como usar o sistema</h3>
<p>Esta página. Vale reler no começo do curso.</p>
<h3>Meus dados</h3>
<p>Acesse pelo seu nome no topo da tela para conferir dados pessoais, contato e documentos (CPF, telefone, endereço). Mantenha tudo atualizado — é por aí que chegam os comunicados e é isso que sai no certificado.</p>

<h2>Minhas turmas</h2>
<h3>Lista de turmas</h3>
<p>Todas as suas <strong>matrículas ativas</strong>: curso, professor, datas, status da turma e o link para ver os detalhes.</p>
<h3>Detalhe da turma</h3>
<p>Informações da oferta — professor, datas, local e status — e o botão <strong>Acessar conteúdo do curso</strong>, que leva à trilha de módulos e aulas. Quando houver, o <strong>certificado</strong> aparece aqui.</p>
<h3>Conteúdo do curso</h3>
<p>Estrutura em <strong>módulos</strong> e <strong>aulas</strong>, com materiais em PDF, links, vídeos e atividades. O sistema registra seu progresso conforme você conclui as aulas.</p>
<h3>Favoritos</h3>
<p>Atalho em Minhas turmas para as aulas e itens que você salvou para revisar depois.</p>

<h2>Evolução e ranking</h2>
<p>Seus pontos, seu nível e sua posição no ranking, junto com o que já foi concluído. Serve para acompanhar seu ritmo ao longo do curso.</p>

<h2>Calendário de aulas</h2>
<p>Suas aulas organizadas por data, com horários e local. Confira antes de sair de casa: feriados e alterações do calendário institucional já aparecem aqui.</p>

<h2>Comunidade IGH</h2>
<p>Espaço de publicações e novidades do instituto, aberto a alunos, professores e equipe. Vale a mesma conduta do fórum.</p>

<h2>Fórum dos cursos</h2>
<p>Escolha o <strong>curso</strong> em que está matriculado e entre nos tópicos daquele curso. Use para tirar dúvidas e debater com colegas e professores, seguindo as regras de conduta da instituição.</p>

<h2>Documentos, certificados e suporte</h2>
<p>Certificados costumam aparecer no <strong>detalhe da turma</strong> ou são comunicados pela secretaria. Outros comprovantes podem ser solicitados pelos canais divulgados pela escola.</p>

<h2>Privacidade e conduta</h2>
<ul>
<li>Não compartilhe sua senha.</li>
<li>Encerre a sessão em computadores públicos ou laboratórios.</li>
<li>Respeite os direitos autorais dos materiais das aulas.</li>
<li>Trate colegas e professores com respeito no fórum, na comunidade e em qualquer interação.</li>
</ul>

<h2>Sobre este texto de ajuda</h2>
<p>Os guias por perfil são atualizados pela equipe. Se algo aqui não bater com a sua tela, avise a secretaria ou o suporte.</p>`,
  },
};

export const ONBOARDING_ROLES_ORDER: UserRole[] = [
  "MASTER",
  "ADMIN",
  "COORDINATOR",
  "POLO_COORDINATOR",
  "TEACHER",
  "STUDENT",
];
