import type { LegalDocumentKind } from "../../src/generated/prisma/client";

/**
 * Primeiras versões modelo (1.0) de documentos legais — rich text HTML.
 * Revise e adapte com o jurídico da instituição antes de produção.
 */
export const LEGAL_DOCUMENTS_V1: {
  kind: LegalDocumentKind;
  versionLabel: string;
  title: string;
  contentRich: string;
}[] = [
  {
    kind: "TERMS",
    versionLabel: "1.0",
    title: "Termos de uso da plataforma",
    contentRich: `<h2>1. Aceitação</h2>
<p>Ao aceder ou utilizar esta plataforma digital (o «Serviço»), o utilizador («Utilizador») declara ter lido, compreendido e aceitado integralmente estes Termos de Uso. Se não concordar, não deve utilizar o Serviço.</p>

<h2>2. Objeto</h2>
<p>O Serviço destina-se a apoiar atividades educacionais e administrativas da instituição, incluindo, conforme aplicável: gestão de cursos e turmas, matrículas, conteúdos pedagógicos, comunicação institucional e áreas reservadas a alunos, professores e equipa administrativa.</p>

<h2>3. Cadastro e conta</h2>
<ul>
<li>O Utilizador compromete-se a fornecer dados verídicos, completos e atualizados.</li>
<li>A conta é pessoal e intransmissível. É proibido partilhar credenciais de acesso com terceiros.</li>
<li>A instituição pode suspender ou encerrar contas em caso de violação destes Termos, uso indevido ou por motivos de segurança.</li>
</ul>

<h2>4. Uso permitido e conduta</h2>
<p>O Utilizador obriga-se a utilizar o Serviço de forma lícita, respeitando a legislação aplicável, os direitos de terceiros e as normas internas divulgadas pela instituição. É proibido, entre outros: tentar obter acesso não autorizado a sistemas ou dados alheios; difundir conteúdos ilícitos, ofensivos ou que violem direitos de propriedade intelectual; utilizar o Serviço para fins comerciais não autorizados ou que prejudiquem o normal funcionamento da plataforma.</p>

<h2>5. Propriedade intelectual</h2>
<p>Conteúdos disponibilizados pela instituição (textos, imagens, vídeos, software, marcas) estão protegidos pela legislação aplicável. Salvo autorização expressa, não é permitida a reprodução, distribuição ou modificação não autorizada.</p>

<h2>6. Disponibilidade e alterações</h2>
<p>A instituição esforça-se por manter o Serviço disponível, mas não garante funcionamento ininterrupto ou livre de erros. Estes Termos e o próprio Serviço podem ser atualizados; a continuação de uso após publicação de nova versão constitui aceitação, salvo disposição em contrário.</p>

<h2>7. Limitação de responsabilidade</h2>
<p>Na medida máxima permitida pela lei, a instituição não será responsável por danos indiretos, lucros cessantes ou perda de dados decorrentes do uso ou impossibilidade de uso do Serviço, salvo dolo ou culpa grave comprovada, quando aplicável.</p>

<h2>8. Lei aplicável e foro</h2>
<p>Estes Termos regem-se pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca da sede da instituição, salvo competência legal imperativa em favor do consumidor.</p>

<h2>9. Contacto</h2>
<p>Para questões sobre estes Termos, utilize os canais de contacto divulgados no site institucional ou no painel da plataforma.</p>`,
  },
  {
    kind: "PRIVACY",
    versionLabel: "1.0",
    title: "Política de privacidade",
    contentRich: `<h2>1. Introdução</h2>
<p>Esta Política de Privacidade descreve como a instituição trata dados pessoais no âmbito da plataforma e dos serviços associados, em conformidade com a Lei n.º 13.709/2018 (Lei Geral de Proteção de Dados Pessoais — LGPD).</p>

<h2>2. Controlador e encarregado</h2>
<p>A instituição atua como controladora dos dados tratados para as finalidades abaixo. O encarregado de proteção de dados (DPO), quando nomeado, poderá ser contactado através dos meios indicados no site ou no painel.</p>

<h2>3. Dados que podemos tratar</h2>
<p>Conforme a relação com o titular e o uso da plataforma, podem ser tratados, entre outros: identificação e contacto (nome, e-mail, telefone); dados académicos e de matrícula; dados de navegação e de sessão; registos de acesso e de segurança; conteúdos enviados voluntariamente (mensagens, ficheiros, participação em fóruns ou formulários).</p>

<h2>4. Finalidades e bases legais</h2>
<ul>
<li><strong>Execução de contrato ou procedimentos preliminares:</strong> gestão de cursos, turmas, matrículas e prestação educativa.</li>
<li><strong>Obrigação legal ou regulamentar:</strong> cumprimento de normas aplicáveis à instituição.</li>
<li><strong>Legítimo interesse:</strong> segurança da informação, melhoria do serviço e prevenção de fraude, observado o equilíbrio com os direitos do titular.</li>
<li><strong>Consentimento:</strong> quando exigido para finalidades específicas (por exemplo, comunicações opcionais ou cookies não essenciais, quando aplicável).</li>
</ul>

<h2>5. Partilha de dados</h2>
<p>Os dados podem ser partilhados com prestadores de serviços que atuam em nome da instituição (alojamento, e-mail, suporte), com obrigações contratuais de confidencialidade e segurança. Podem ainda ser comunicados às autoridades quando a lei o exigir.</p>

<h2>6. Retenção</h2>
<p>Os dados são conservados pelo tempo necessário ao cumprimento das finalidades e às obrigações legais, apagados ou anonimizados quando deixarem de ser necessários, salvo base legal para manutenção.</p>

<h2>7. Direitos do titular (LGPD)</h2>
<p>O titular pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação de dados tratados com consentimento, informação sobre partilhas e revogação do consentimento quando aplicável. Pedidos devem ser formulados pelos canais indicados pela instituição, que responderá no prazo legal.</p>

<h2>8. Cookies e tecnologias similares</h2>
<p>O site e a plataforma podem utilizar cookies e tecnologias similares. Os cookies estritamente necessários ao funcionamento podem ser utilizados com base no legítimo interesse ou execução do serviço. Outras categorias, quando utilizadas, serão descritas na Política de Cookies e, quando exigido, dependerão de consentimento.</p>

<h2>9. Segurança</h2>
<p>São adotadas medidas técnicas e organizativas razoáveis para proteger os dados contra acessos não autorizados, perda ou alteração indevida.</p>

<h2>10. Alterações</h2>
<p>Esta política pode ser atualizada. A data da versão em vigor será indicada na plataforma; recomenda-se consulta periódica.</p>`,
  },
  {
    kind: "COOKIE_POLICY",
    versionLabel: "1.0",
    title: "Política de cookies",
    contentRich: `<h2>1. O que são cookies</h2>
<p>Cookies são pequenos ficheiros ou fragmentos de dados armazenados no seu dispositivo (computador, tablet ou telemóvel) quando visita um site ou utiliza uma aplicação web. Tecnologias similares (por exemplo, armazenamento local) podem ser utilizadas para as mesmas finalidades descritas abaixo.</p>

<h2>2. Como utilizamos cookies neste site e na plataforma</h2>
<p>Utilizamos cookies para:</p>
<ul>
<li><strong>Funcionamento essencial:</strong> manter sessões de login seguras, preferências básicas e carregamento correto das páginas.</li>
<li><strong>Segurança:</strong> prevenir usos abusivos e proteger contas.</li>
<li><strong>Desempenho e estatísticas agregadas:</strong> quando ativado, para compreender de forma anónima ou agregada como o serviço é utilizado (por exemplo, métricas de utilização).</li>
</ul>
<p>Cookies não essenciais (por exemplo, marketing ou alguns de medição) só devem ser ativados com base no consentimento livre, informado e inequívoco, quando aplicável à configuração da plataforma.</p>

<h2>3. Tipos de cookies (referência)</h2>
<ul>
<li><strong>Sessão ou persistentes:</strong> sessão expira ao fechar o navegador; persistentes permanecem até à data de validade ou remoção manual.</li>
<li><strong>Próprios ou de terceiros:</strong> próprios são definidos pela instituição; de terceiros podem estar associados a serviços integrados (por exemplo, vídeo ou análise), conforme as respetivas políticas.</li>
</ul>

<h2>4. Como gerir ou recusar cookies</h2>
<p>Pode configurar o seu navegador para bloquear ou eliminar cookies. Note que bloquear cookies necessários pode impedir o correto funcionamento do login ou de partes do site. Consulte a ajuda do seu navegador (Chrome, Firefox, Safari, Edge, etc.) para instruções.</p>
<p>Quando existir banner ou centro de preferências de cookies na plataforma, pode utilizar essas ferramentas para escolher categorias não essenciais.</p>

<h2>5. Relação com a Política de Privacidade</h2>
<p>O tratamento de dados pessoais associado a cookies e identificadores é complementado pela <strong>Política de Privacidade</strong>, onde se descrevem finalidades, bases legais e direitos dos titulares ao abrigo da LGPD.</p>

<h2>6. Atualizações</h2>
<p>Esta política pode ser revista para refletir alterações tecnológicas ou legais. A versão em vigor está identificada na plataforma.</p>`,
  },
];
