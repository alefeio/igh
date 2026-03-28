import type { UserRole } from "../../src/generated/prisma/client";

/** Títulos alinhados a `DEFAULT_TITLE` em `src/app/api/onboarding/route.ts`. */
export const ONBOARDING_GUIDES: Record<UserRole, { title: string; contentRich: string }> = {
  MASTER: {
    title: "Como usar o sistema — Master",
    contentRich: `<h2>Visão geral do perfil Master</h2>
<p>O <strong>Master</strong> tem o maior alcance na plataforma: gestão de usuários e aprovações sensíveis, núcleo acadêmico (cursos, turmas, matrículas, alunos), comunicação institucional (site e campanhas), coordenação de chamados e configurações críticas (horários-base, feriados, backup). Use o <strong>menu à esquerda</strong> como mapa. Esta página (<strong>Como usar o sistema</strong>) concentra o guia; Master e Administrador podem editar os textos por perfil em <strong>Guia do sistema (edição)</strong>.</p>

<h2>Início</h2>
<h3>Dashboard</h3>
<p>Resumo da operação: atalhos, indicadores e avisos. Ponto de partida após o login.</p>
<h3>Como usar o sistema</h3>
<p>Esta página — guia em texto rico por perfil. Indique novos colaboradores a lerem na primeira semana.</p>
<h3>Meus dados</h3>
<p>Cadastro pessoal (nome, e-mail, telefone, etc.) e dados que a instituição permitir editar.</p>
<h3>Coordenação</h3>
<p>Fila de <strong>reportes</strong> da equipe e professores: abertura de chamados, mensagens, anexos, status até encerramento. Use para dúvidas operacionais que não são configuração global.</p>

<h2>Administração</h2>
<h3>Guia do sistema (edição)</h3>
<p>Edição dos textos de onboarding por perfil (Master e Administrador), com suporte a rich text e imagens. Alterações refletem na página <strong>Como usar o sistema</strong> de cada tipo de usuário.</p>
<h3>Usuários (Admin)</h3>
<p>Criação e manutenção de contas, perfis e papéis. Operação sensível — alinhe com política de acesso da instituição.</p>
<h3>Aprovações (Site)</h3>
<p>Fluxos em que conteúdo público ou alterações no site exigem validação antes de publicar (conforme regras da instalação).</p>
<h3>Professores</h3>
<p>Cadastro de docentes, vínculos com cursos/turmas e dados necessários para o portal do professor.</p>
<h3>Formações</h3>
<p>Gestão de conteúdo de formações no painel (catálogo, módulos e materiais usados na área institucional / formações).</p>
<h3>Cursos</h3>
<p>Estrutura pedagógica: cursos, módulos, aulas, materiais, requisitos e configurações ligadas ao conteúdo.</p>
<h3>Turmas</h3>
<p>Turmas ofertadas: vínculo com curso, professor(es), calendário, vagas, status e local quando aplicável.</p>
<h3>Quadro de horários</h3>
<p>Visualização e organização dos horários das turmas (grade), apoiando conflitos e planejamento.</p>
<h3>Fóruns (todos os cursos)</h3>
<p>Visão transversal dos fóruns por curso: tópicos, participação e moderação institucional.</p>
<h3>Gamificação (professores)</h3>
<p>Regras de pontuação, níveis e acompanhamento ligados ao engajamento (conforme configuração da escola).</p>
<h3>Matrículas</h3>
<p>Inclusão, alteração e situação de matrículas dos alunos nas turmas.</p>
<h3>Frequência (todas as turmas)</h3>
<p>Consolidado ou lançamento de presença conforme o fluxo definido pela instituição.</p>
<h3>Avaliações (alunos)</h3>
<p>Feedbacks de experiência / avaliações de curso reunidos para análise pedagógica e qualidade.</p>
<h3>Alunos</h3>
<p>Cadastro e ficha do aluno, vínculos com turmas e dados acadêmicos administrativos.</p>

<h2>Site (institucional)</h2>
<p>Conjunto de telas que alimentam o site público e landing pages.</p>
<ul>
<li><strong>Configurações</strong> — identidade, contatos, integrações e parâmetros gerais do site.</li>
<li><strong>Mensagens de contato</strong> — formulários recebidos pela página de contato.</li>
<li><strong>Sobre</strong> — texto e elementos da página institucional “Sobre”.</li>
<li><strong>Formações (página)</strong> — conteúdo da página pública de formações.</li>
<li><strong>Inscreva-se (página)</strong> — página de captação / inscrição.</li>
<li><strong>Contato (página)</strong> — edição da página de contato.</li>
<li><strong>Menu do site</strong> — itens e ordem da navegação pública.</li>
<li><strong>Banners</strong> e <strong>Banners (tablet)</strong> — destaques visuais no site e em vitrine tablet, se usados.</li>
<li><strong>Projetos</strong>, <strong>Depoimentos</strong>, <strong>Parceiros</strong>, <strong>Notícias</strong>, <strong>FAQ</strong>, <strong>Transparência</strong> — seções de conteúdo conforme o projeto do site.</li>
</ul>

<h2>Campanhas</h2>
<ul>
<li><strong>Campanhas SMS</strong> — disparos em massa via SMS (templates, público, agendamento conforme integração).</li>
<li><strong>Campanhas de E-mail</strong> — envios institucionais em massa; respeite LGPD e base legal.</li>
</ul>

<h2>Configurações (sistema)</h2>
<ul>
<li><strong>Horários</strong> — cadastro de <em>slots</em> de horário reutilizáveis na montagem de grades.</li>
<li><strong>Eventos e Feriados</strong> — datas que podem afetar calendário de aulas e feriados.</li>
<li><strong>Backup do banco</strong> — operação crítica; restrinja a pessoas autorizadas e horários seguros.</li>
</ul>

<h2>Boas práticas</h2>
<ul>
<li>Alterações em produção: preferir janelas de menor uso e registro do que foi feito.</li>
<li>Proteja credenciais; use contas pessoais auditáveis.</li>
<li>Trate dados pessoais conforme LGPD e política interna.</li>
</ul>`,
  },

  ADMIN: {
    title: "Como usar o sistema — Administrador",
    contentRich: `<h2>Visão geral do perfil Administrador</h2>
<p>O <strong>Administrador</strong> opera a maior parte do dia a dia: cursos, turmas, matrículas, alunos, professores, site institucional, frequência, avaliações e campanhas (quando liberadas). Com o <strong>Master</strong>, pode editar os textos de onboarding em <strong>Guia do sistema (edição)</strong>. Alguns itens do menu ficam só para <strong>Master</strong> ou <strong>Coordenador</strong> (ex.: certos cadastros globais, backup) — se não vir uma opção, alinhe com a gestão.</p>

<h2>Início</h2>
<h3>Dashboard</h3>
<p>Visão geral, atalhos e avisos para a rotina administrativa.</p>
<h3>Como usar o sistema</h3>
<p>Guia por perfil (esta página). Recomende a leitura a novos administradores.</p>
<h3>Meus dados</h3>
<p>Seus dados cadastrais e contato institucional.</p>
<h3>Coordenação</h3>
<p>Acompanhamento de <strong>reportes</strong> enviados por professores e equipe: mensagens, anexos e status até a conclusão.</p>

<h2>Administração (o que você costuma usar)</h2>
<h3>Guia do sistema (edição)</h3>
<p>Atualização dos textos de ajuda por perfil (Aluno, Professor, Coordenador, etc.), com rich text e imagens.</p>
<h3>Professores</h3>
<p>Cadastro e gestão de docentes e vínculos com cursos e turmas.</p>
<h3>Formações</h3>
<p>Conteúdo administrativo de formações no painel (alinhado à área pública de formações).</p>
<h3>Cursos</h3>
<p>Estrutura de cursos, módulos, aulas e materiais.</p>
<h3>Turmas</h3>
<p>Ofertas, professores, calendário, vagas e status das turmas.</p>
<h3>Quadro de horários</h3>
<p>Organização e consulta da grade de horários das turmas.</p>
<h3>Fóruns (todos os cursos)</h3>
<p>Moderação e visão geral dos fóruns por curso.</p>
<h3>Gamificação (professores)</h3>
<p>Acompanhamento de regras e resultados de gamificação quando ativo.</p>
<h3>Matrículas</h3>
<p>Gestão das matrículas dos alunos nas turmas.</p>
<h3>Frequência (todas as turmas)</h3>
<p>Lançamento ou consolidação de presenças conforme o processo da escola.</p>
<h3>Avaliações (alunos)</h3>
<p>Feedbacks e avaliações de experiência para melhoria contínua.</p>
<h3>Alunos</h3>
<p>Cadastro, consulta e vínculos acadêmicos dos alunos.</p>

<h2>O que normalmente é exclusivo do Master ou Coordenador</h2>
<p>Dependendo do menu da sua instalação, itens como <strong>Usuários (Admin)</strong>, <strong>Aprovações (Site)</strong>, cadastro de <strong>Horários</strong> (slots), <strong>Eventos e Feriados</strong> e <strong>Backup do banco</strong> podem não aparecer para Administrador puro. Solicite elevação de perfil ou operação pelo Master quando necessário.</p>

<h2>Site e campanhas</h2>
<p>Todas as entradas da seção <strong>Site</strong> (configurações, páginas, banners, notícias, FAQ, menu, depoimentos, etc.) para manter o conteúdo público atualizado. <strong>Campanhas SMS</strong> e <strong>Campanhas de E-mail</strong> quando estiverem liberadas no menu — planeje público, mensagem e conformidade com LGPD.</p>

<h2>Boas práticas</h2>
<ul>
<li>Documente mudanças relevantes em conteúdo público.</li>
<li>Valide dados antes de matrículas e alterações em turmas em andamento.</li>
<li>Encerre a sessão em computadores compartilhados.</li>
</ul>`,
  },

  COORDINATOR: {
    title: "Como usar o sistema — Coordenador",
    contentRich: `<h2>Visão geral do perfil Coordenador</h2>
<p>O <strong>Coordenador</strong> apoia a gestão acadêmica e operacional: cursos, turmas, matrículas, alunos, horários, fóruns, frequência, avaliações, site e campanhas — em muito alinhado ao Administrador e, em várias instalações, com itens extras próximos ao Master (usuários, aprovações, slots de horário, feriados, backup). O menu pode variar; use este guia junto com o que você efetivamente vê à esquerda.</p>

<h2>Início</h2>
<h3>Dashboard</h3>
<p>Resumo e atalhos para acompanhar a operação.</p>
<h3>Como usar o sistema</h3>
<p>Guia específico do perfil (esta página).</p>
<h3>Meus dados</h3>
<p>Atualização de dados pessoais e de contato.</p>
<h3>Coordenação</h3>
<p>Área central de <strong>reportes</strong>: professores e equipe abrem chamados; você responde, anexa arquivos e acompanha até o fechamento. Mantenha o histórico no próprio ticket para rastreabilidade.</p>

<h2>Acadêmico</h2>
<h3>Cursos</h3>
<p>Cadastro e manutenção da estrutura de cursos (módulos, aulas, conteúdo).</p>
<h3>Turmas</h3>
<p>Ofertas, vínculos com cursos e professores, vagas, status e local.</p>
<h3>Matrículas</h3>
<p>Situação e gestão das matrículas dos alunos.</p>
<h3>Alunos</h3>
<p>Cadastro e acompanhamento dos estudantes.</p>
<h3>Professores</h3>
<p>Cadastro e organização docente quando disponível no seu menu.</p>
<h3>Quadro de horários</h3>
<p>Planejamento visual da grade; apoio a conflitos de horário.</p>
<h3>Horários (slots)</h3>
<p>Quando disponível: cadastro dos blocos de hora reutilizados na grade.</p>
<h3>Frequência (todas as turmas)</h3>
<p>Visão consolidada ou lançamentos de presença.</p>
<h3>Fóruns (todos os cursos)</h3>
<p>Supervisão e moderação institucional dos fóruns.</p>
<h3>Gamificação (professores)</h3>
<p>Acompanhamento de engajamento e regras, se ativo na instituição.</p>
<h3>Avaliações (alunos)</h3>
<p>Análise de feedbacks de experiência para melhoria de cursos e atendimento.</p>

<h2>Site e comunicação</h2>
<p>Edição das páginas e seções do site (configurações, banners, notícias, FAQ, depoimentos, transparência, menu, etc.). <strong>Campanhas SMS</strong> e <strong>E-mail</strong> para comunicação em massa, sempre com base legal e opt-in quando exigido.</p>

<h2>Ferramentas administrativas adicionais (se aparecerem no menu)</h2>
<ul>
<li><strong>Usuários</strong> e <strong>Aprovações (Site)</strong> — governança de contas e publicação.</li>
<li><strong>Eventos e Feriados</strong> — calendário acadêmico.</li>
<li><strong>Backup do banco</strong> — use apenas se autorizado e em janela segura.</li>
</ul>

<h2>Edição deste guia</h2>
<p>Os textos de ajuda por perfil são mantidos por <strong>Master</strong> ou <strong>Administrador</strong> em <strong>Guia do sistema (edição)</strong>. Se algo estiver desatualizado, solicite a atualização à equipe.</p>

<h2>Boas práticas</h2>
<ul>
<li>Alinhe decisões acadêmicas sensíveis (notas, certificação, políticas) com a direção.</li>
<li>Proteja senhas e dados dos alunos (LGPD).</li>
</ul>`,
  },

  TEACHER: {
    title: "Como usar o sistema — Professor",
    contentRich: `<h2>Visão geral do perfil Professor</h2>
<p>Como <strong>Professor</strong>, você organiza o ensino nas turmas que leciona: acessa conteúdo, materiais e aulas, registra ou consulta frequência, participa de fóruns, acompanha gamificação e avaliações de experiência, e pode abrir chamados em <strong>Coordenação</strong>. O menu também pode exibir <strong>Cursos</strong> e <strong>Alunos</strong> para consulta conforme a política da escola.</p>

<h2>Início</h2>
<h3>Dashboard</h3>
<p>Resumo, avisos e atalhos para suas turmas e tarefas.</p>
<h3>Como usar o sistema</h3>
<p>Guia de uso (esta página).</p>
<h3>Meus dados</h3>
<p>Mantenha e-mail e telefone atualizados para contato institucional.</p>
<h3>Coordenação</h3>
<p>Envie <strong>reportes</strong> à coordenação (dúvidas, solicitações, problemas em sala, anexos). Acompanhe respostas no mesmo chamado para manter o contexto.</p>

<h2>Professor — suas turmas e aulas</h2>
<h3>Turmas que leciono</h3>
<p>Lista das turmas atribuídas a você. Em cada turma você pode ver informações da oferta, acessar o <strong>conteúdo do curso</strong> (módulos e aulas), abrir o modo <strong>apresentar aula</strong> quando disponível, e seguir o fluxo pedagógico definido pela instituição.</p>
<h3>Conteúdo e aulas (dentro da turma)</h3>
<p>Navegue por módulos e aulas; utilize materiais anexos, links e recursos publicados. Em aulas específicas, ferramentas como anotações ou apresentação podem estar disponíveis conforme a configuração.</p>
<h3>Fórum dos cursos</h3>
<p>Acesso ao fórum por curso em que você atua — responda tópicos, oriente alunos e mantenha o tom profissional definido pela escola.</p>

<h2>Frequência, engajamento e feedback</h2>
<h3>Frequência (turmas)</h3>
<p>Registro ou consulta de presença dos alunos nas suas turmas, conforme o processo (chamada, justificativas, etc.).</p>
<h3>Gamificação (professores)</h3>
<p>Regras de pontos, níveis ou rankings quando a gamificação estiver ativa — acompanhe para alinhar com a dinâmica de sala.</p>
<h3>Avaliações dos alunos</h3>
<p>Feedbacks de experiência das turmas em que você leciona — útil para ajustar didática e comunicação.</p>

<h2>Cursos e alunos (consulta)</h2>
<h3>Cursos</h3>
<p>Visão dos cursos em que você está vinculado (estrutura, dependendo das permissões).</p>
<h3>Alunos</h3>
<p>Consulta ou apoio a cadastros de alunos quando liberado — respeite privacidade e finalidade pedagógica/administrativa.</p>

<h2>O que costuma ficar com a administração</h2>
<p>Configuração global do site, matrículas de terceiros, campanhas institucionais amplas e backup são típicos de <strong>Administração</strong> ou <strong>Coordenação</strong>. A edição dos textos deste guia é feita por <strong>Master</strong> ou <strong>Administrador</strong> em <strong>Guia do sistema (edição)</strong>.</p>

<h2>Boas práticas</h2>
<ul>
<li>Publique materiais e prazos com antecedência.</li>
<li>Use o fórum ou a Coordenação conforme o canal oficial da escola.</li>
<li>Encerre a sessão em equipamentos compartilhados.</li>
</ul>`,
  },

  STUDENT: {
    title: "Como usar o sistema — Aluno",
    contentRich: `<h2>Visão geral do portal do aluno</h2>
<p>O portal concentra o que você precisa para estudar: <strong>turmas</strong> e <strong>matrículas</strong>, <strong>conteúdo</strong> (módulos, aulas, materiais e atividades), <strong>fórum</strong> por curso, <strong>favoritos</strong> para revisão, e seus <strong>dados cadastrais</strong>. Use o menu à esquerda para navegar. Esta página explica cada área em detalhe.</p>

<h2>Início</h2>
<h3>Dashboard</h3>
<p>Painel inicial com avisos, atalhos e resumo do seu progresso quando disponível.</p>
<h3>Como usar o sistema</h3>
<p>Guia de uso (esta página). Vale reler no início do curso.</p>
<h3>Meus dados</h3>
<p>Seus dados pessoais, contato e documentos que a instituição permitir enviar ou atualizar (CPF, telefone, endereço, etc.). Mantenha tudo atualizado para comunicados e certificados.</p>

<h2>Minhas turmas</h2>
<h3>Lista de turmas</h3>
<p>Mostra todas as <strong>matrículas ativas</strong>: nome do curso, professor, datas, status da turma (em andamento, encerrada, etc.) e link para <strong>Ver detalhes</strong>.</p>
<h3>Detalhe da turma</h3>
<p>Informações da oferta: professor, datas, local, status. Se a instituição publicar, pode haver link para <strong>certificado</strong>. O botão <strong>Acessar conteúdo do curso</strong> leva à trilha de módulos e aulas.</p>
<h3>Conteúdo do curso</h3>
<p>Estrutura em <strong>módulos</strong> e <strong>aulas</strong>: acesse materiais em PDF ou links, vídeos quando houver, e atividades ou questionários configurados pela escola. O sistema pode registrar seu progresso ao concluir aulas.</p>
<h3>Página de uma aula</h3>
<p>Visualização do conteúdo da aula: texto, mídia, anexos para download e exercícios. Use os recursos indicados pelo professor; em alguns casos há discussão ou fórum ligado ao tema.</p>
<h3>Favoritos</h3>
<p>Atalho em <strong>Minhas turmas</strong> (seção “Atalhos úteis”) para <strong>Favoritos</strong> — aulas ou itens que você salvou para revisar depois.</p>

<h2>Fórum dos cursos</h2>
<p>Primeiro escolha o <strong>curso</strong> em que está matriculado; depois entre nos tópicos do fórum daquele curso. Use para tirar dúvidas e debater com colegas e professores, seguindo as regras de conduta da instituição. Volte à lista de turmas pelo link indicado na página quando precisar.</p>

<h2>Documentos, certificados e suporte</h2>
<p>Certificados, quando existirem, costumam aparecer no <strong>detalhe da turma</strong> ou serem comunicados pela secretaria. Comprovantes e documentos podem ser solicitados em <strong>Meus dados</strong> ou por canais externos (e-mail, telefone) divulgados pela escola.</p>

<h2>Privacidade e conduta</h2>
<ul>
<li>Não compartilhe sua senha.</li>
<li>Encerre a sessão em computadores públicos ou laboratórios.</li>
<li>Respeite direitos autorais dos materiais das aulas.</li>
<li>Trate colegas e professores com respeito no fórum e em qualquer interação.</li>
</ul>

<h2>Sobre este texto de ajuda</h2>
<p>Os guias por perfil são atualizados pela equipe em <strong>Guia do sistema (edição)</strong>. Se algo aqui não bater com a sua tela, avise a secretaria ou o suporte.</p>`,
  },
};

export const ONBOARDING_ROLES_ORDER: UserRole[] = ["MASTER", "ADMIN", "COORDINATOR", "TEACHER", "STUDENT"];
