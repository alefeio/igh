import "server-only";

import { getAppUrl } from "./index";

const TERMS_VERSION = "v1-2026-02";
const COMPANY_NAME = "Instituto Gustavo Hessel";

function getLogoUrl(): string {
  return getAppUrl("/images/logo.png");
}

function emailHeader(): string {
  const logoUrl = getLogoUrl();
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #fff;">
  <tr>
    <td style="padding: 24px 24px 16px; text-align: center; border-bottom: 1px solid #e5e7eb;">
      <img src="${logoUrl}" alt="${escapeHtml(COMPANY_NAME)}" width="120" height="auto" style="display: block; margin: 0 auto 12px;" />
      <div style="font-size: 18px; font-weight: 600; color: #1f2937;">${escapeHtml(COMPANY_NAME)}</div>
    </td>
  </tr>
</table>`;
}

function emailFooter(): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
  <tr>
    <td style="padding: 24px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
      Esta mensagem foi enviada por ${escapeHtml(COMPANY_NAME)}. Em caso de dúvidas, entre em contato.
    </td>
  </tr>
</table>`;
}

function wrapHtml(body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f3f4f6;">
${emailHeader()}
<table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #fff;">
  <tr>
    <td style="padding: 24px;">
${body}
    </td>
  </tr>
</table>
${emailFooter()}
</body>
</html>`;
}

export function templateAdminWelcome(params: {
  name: string;
  email: string;
  tempPassword: string;
}): { subject: string; html: string } {
  const { name, email, tempPassword } = params;
  const loginUrl = getAppUrl("/login");
  const body = `
<h2>Acesso liberado - Área administrativa</h2>
<p>Olá, <strong>${escapeHtml(name)}</strong>.</p>
<p>Seu cadastro na área administrativa foi realizado. Use os dados abaixo para acessar o sistema:</p>
<ul>
  <li><strong>Link de acesso:</strong> <a href="${loginUrl}">${loginUrl}</a></li>
  <li><strong>Usuário (e-mail):</strong> ${escapeHtml(email)}</li>
  <li><strong>Senha temporária:</strong> <code style="background:#f0f0f0;padding:2px 6px;">${escapeHtml(tempPassword)}</code></li>
</ul>
<p><strong>Importante:</strong> Por segurança, você deverá trocar a senha no primeiro acesso.</p>
<p>Guarde esta mensagem em local seguro até alterar sua senha. Não compartilhe sua senha com ninguém.</p>
`;
  return { subject: "Acesso liberado - Área administrativa", html: wrapHtml(body) };
}

export function templateProfessorWelcome(params: {
  name: string;
  email: string;
  tempPassword: string;
}): { subject: string; html: string } {
  const { name, email, tempPassword } = params;
  const loginUrl = getAppUrl("/login");
  const body = `
<h2>Bem-vindo(a) - Acesso de Professor</h2>
<p>Olá, <strong>${escapeHtml(name)}</strong>.</p>
<p>Seu cadastro como professor foi realizado. Use os dados abaixo para acessar o sistema e gerenciar suas turmas e agenda:</p>
<ul>
  <li><strong>Link de acesso:</strong> <a href="${loginUrl}">${loginUrl}</a></li>
  <li><strong>Usuário (e-mail):</strong> ${escapeHtml(email)}</li>
  <li><strong>Senha temporária:</strong> <code style="background:#f0f0f0;padding:2px 6px;">${escapeHtml(tempPassword)}</code></li>
</ul>
<p><strong>Importante:</strong> Você deverá trocar a senha no primeiro acesso.</p>
<p>Guarde esta mensagem em local seguro até alterar sua senha.</p>
`;
  return { subject: "Bem-vindo(a) - Acesso de Professor", html: wrapHtml(body) };
}

/** E-mail enviado ao cadastrar o aluno (com e-mail), antes de matrícula em turma. */
export function templateStudentRegistered(params: {
  name: string;
  email: string;
  birthDateFormatted: string;
}): { subject: string; html: string } {
  const { name, email, birthDateFormatted } = params;
  const loginUrl = getAppUrl("/login");
  const meusDadosUrl = getAppUrl("/meus-dados");
  const body = `
<h2>Cadastro realizado</h2>
<p>Olá, <strong>${escapeHtml(name)}</strong>.</p>
<p>Seu cadastro como aluno foi realizado no sistema do ${escapeHtml(COMPANY_NAME)}. Use os dados abaixo para acessar a plataforma:</p>
<ul>
  <li><strong>Link de acesso:</strong> <a href="${loginUrl}">${loginUrl}</a></li>
  <li><strong>Usuário (e-mail):</strong> ${escapeHtml(email)}</li>
  <li><strong>Senha para primeiro acesso:</strong> use sua <strong>data de nascimento</strong> no formato DD/MM/AAAA (${escapeHtml(birthDateFormatted)}).</li>
</ul>
<p><strong>Para sua matrícula ser concluída</strong>, após fazer login você deve:</p>
<ol>
  <li>Acessar a área do aluno e ir em <strong>Meus dados</strong> (<a href="${meusDadosUrl}">${meusDadosUrl}</a>).</li>
  <li>Completar todos os dados restantes do cadastro (endereço, documento, etc.).</li>
  <li>Anexar o <strong>documento de identidade</strong> e o <strong>comprovante de residência</strong>.</li>
</ol>
<p>Somente após o envio desses dados e anexos sua matrícula poderá ser confirmada pela equipe. Troque a senha no primeiro acesso e guarde esta mensagem em local seguro.</p>
<p>Quando sua pré-matrícula for confirmada, você receberá outro e-mail com os dados do curso.</p>
`;
  return { subject: "Cadastro realizado - Instituto Gustavo Hessel", html: wrapHtml(body) };
}

function wrapStudentHtml(body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: linear-gradient(180deg, #f0f9ff 0%, #f3f4f6 100%);">
${emailHeader()}
<table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
  <tr>
    <td style="padding: 24px;">
${body}
    </td>
  </tr>
</table>
${emailFooter()}
</body>
</html>`;
}

export function templateStudentWelcome(params: {
  name: string;
  email: string;
  tempPassword: string | null;
  courseName: string;
  startDate: string;
  daysOfWeek: string;
  startTime: string;
  endTime: string;
  location: string | null;
  confirmUrl: string;
}): { subject: string; html: string } {
  const { name, email, tempPassword, courseName, startDate, daysOfWeek, startTime, endTime, location, confirmUrl } = params;
  const loginUrl = getAppUrl("/login");
  const firstName = name.trim().split(/\s+/)[0] || name;
  const accessBlock = tempPassword
    ? `
      <p style="margin: 0 0 8px; font-size: 14px; color: #0c4a6e;"><strong>E-mail:</strong> ${escapeHtml(email)}</p>
      <p style="margin: 4px 0 0; font-size: 14px; color: #0c4a6e;"><strong>Senha temporária:</strong> <code style="background: #fff; padding: 2px 8px; border-radius: 4px; font-size: 13px;">${escapeHtml(tempPassword)}</code></p>
      <p style="margin: 12px 0 0; font-size: 13px; color: #0369a1;">Troque a senha no primeiro acesso. <a href="${loginUrl}" style="color: #0284c7;">Fazer login</a></p>`
    : `
      <p style="margin: 0 0 8px; font-size: 14px; color: #0c4a6e;">Acesse com seu e-mail e a senha que você já cadastrou.</p>
      <p style="margin: 8px 0 0; font-size: 13px; color: #0369a1;"><a href="${loginUrl}" style="color: #0284c7;">Fazer login</a></p>`;
  const locationBlock = location
    ? `<tr><td style="padding: 8px 0; font-size: 14px; color: #4b5563;"><strong>Local:</strong></td><td style="padding: 8px 0; font-size: 14px; color: #1f2937;">${escapeHtml(location)}</td></tr>`
    : "";
  const body = `
<table width="100%" cellpadding="0" cellspacing="0" style="background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
  <tr>
    <td style="padding: 28px 24px;">
      <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #1e40af;">Olá, ${escapeHtml(firstName)}! 👋</h1>
      <p style="margin: 0 0 24px; font-size: 16px; color: #4b5563;">Que bom ter você conosco. Sua matrícula foi registrada com sucesso.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border-radius: 10px; margin-bottom: 24px;">
        <tr><td style="padding: 16px 20px;">
          <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Sua turma</div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding: 8px 0; font-size: 14px; color: #4b5563;"><strong>Curso:</strong></td><td style="padding: 8px 0; font-size: 14px; color: #1f2937;">${escapeHtml(courseName)}</td></tr>
            <tr><td style="padding: 8px 0; font-size: 14px; color: #4b5563;"><strong>Início:</strong></td><td style="padding: 8px 0; font-size: 14px; color: #1f2937;">${escapeHtml(startDate)}</td></tr>
            <tr><td style="padding: 8px 0; font-size: 14px; color: #4b5563;"><strong>Dias:</strong></td><td style="padding: 8px 0; font-size: 14px; color: #1f2937;">${escapeHtml(daysOfWeek)}</td></tr>
            <tr><td style="padding: 8px 0; font-size: 14px; color: #4b5563;"><strong>Horário:</strong></td><td style="padding: 8px 0; font-size: 14px; color: #1f2937;">${startTime} às ${endTime}</td></tr>
            ${locationBlock}
          </table>
        </td></tr>
      </table>

      <p style="margin: 0 0 20px; font-size: 15px; color: #374151;">Para ativar sua inscrição, confirme que leu e aceita os termos de uso clicando no botão abaixo:</p>
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding: 8px 0 24px;">
        <a href="${confirmUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #fff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(30, 64, 175, 0.35);">Confirmar minha inscrição</a>
      </td></tr></table>

      <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0f9ff; border-radius: 10px; border: 1px solid #bae6fd;">
        <tr><td style="padding: 16px 20px;">
          <div style="font-size: 12px; font-weight: 600; color: #0369a1; margin-bottom: 8px;">Acesso ao sistema</div>
          <p style="margin: 0 0 8px; font-size: 14px; color: #0c4a6e;">Após confirmar sua inscrição:</p>
          ${accessBlock}
        </td></tr>
      </table>
    </td>
  </tr>
</table>
`;
  return { subject: `Confirme sua inscrição no curso ${escapeHtml(courseName)}`, html: wrapStudentHtml(body) };
}

/** E-mail de redefinição de senha: link para definir nova senha. */
export function templatePasswordReset(params: { name: string; resetUrl: string }): { subject: string; html: string } {
  const { name, resetUrl } = params;
  const body = `
<h2>Redefinição de senha</h2>
<p>Olá, <strong>${escapeHtml(name)}</strong>.</p>
<p>Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para definir uma nova senha:</p>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding: 16px 0;">
  <a href="${escapeHtml(resetUrl)}" style="display: inline-block; background: #1e40af; color: #fff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">Redefinir senha</a>
</td></tr></table>
<p>Se você não solicitou essa alteração, ignore este e-mail. O link expira em 24 horas.</p>
`;
  return { subject: "Redefinição de senha - Instituto Gustavo Hessel", html: wrapHtml(body) };
}

export { TERMS_VERSION };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
