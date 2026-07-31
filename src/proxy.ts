import { NextResponse, type NextRequest } from "next/server";

import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/setup", "/confirmar-inscricao", "/esqueci-senha", "/redefinir-senha"];
const AUTH_COOKIE_NAME = "auth_token";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname + (request.nextUrl.search || ""));
    return NextResponse.redirect(loginUrl);
  }

  let role: string | undefined;
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");
    const { payload } = await jwtVerify(token, secret);
    role = typeof payload.role === "string" ? payload.role : undefined;
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname + (request.nextUrl.search || ""));
    return NextResponse.redirect(loginUrl);
  }

  const dashboardUrl = new URL("/dashboard", request.url);

  /**
   * Governança da plataforma (Administração, Site e Configurações).
   *
   * O coordenador fica de fora: o perfil é de coordenação pedagógica e não responde por
   * essas áreas. O admin entra em tudo, mas o que mexe no site passa pela fila de aprovação
   * do Master.
   */
  const PLATFORM_GOVERNANCE = ["MASTER", "GENERAL_ADMIN", "ADMIN"];

  const isMasterEquivalent = role === "MASTER" || role === "GENERAL_ADMIN";

  // Usuários, backup e cadastro de horários: Master e Administrador Geral
  if (["/users", "/backup", "/time-slots"].some((p) => pathname.startsWith(p))) {
    if (!isMasterEquivalent) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Fila de aprovação do site: Master e Administrador Geral
  if (pathname.startsWith("/approvacoes")) {
    if (!isMasterEquivalent) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Professores e turmas (cadastro): Master, Admin Geral, Admin ou Coordenador
  if (pathname.startsWith("/teachers") || pathname.startsWith("/class-groups")) {
    if (!["MASTER", "GENERAL_ADMIN", "ADMIN", "COORDINATOR"].includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Cursos: Master, Admin Geral, Admin, Coordenador ou Professor
  if (pathname.startsWith("/courses")) {
    if (!["MASTER", "GENERAL_ADMIN", "ADMIN", "COORDINATOR", "TEACHER"].includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Matrículas: Master, Admin Geral, Admin, Coordenador, Coordenador de Polos ou Professor
  if (pathname.startsWith("/enrollments")) {
    if (!["MASTER", "GENERAL_ADMIN", "ADMIN", "COORDINATOR", "POLO_COORDINATOR", "TEACHER"].includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Polos: Master, Admin Geral, Admin ou Coordenador
  if (pathname.startsWith("/admin/polos")) {
    if (!["MASTER", "GENERAL_ADMIN", "ADMIN", "COORDINATOR"].includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Alunos: Master, Admin Geral, Admin, Coordenador ou Professor
  if (pathname.startsWith("/students")) {
    if (!["MASTER", "GENERAL_ADMIN", "ADMIN", "COORDINATOR", "TEACHER"].includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Moderação da comunidade, fóruns e avaliações de experiência
  if (
    pathname.startsWith("/admin/comunidade") ||
    pathname.startsWith("/admin/forum") ||
    pathname.startsWith("/admin/avaliacoes-experiencia")
  ) {
    if (!PLATFORM_GOVERNANCE.includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Gamificação e ranking: governança da plataforma e professores (que acompanham as turmas)
  if (pathname.startsWith("/gamificacao") || pathname.startsWith("/ranking-alunos")) {
    if (![...PLATFORM_GOVERNANCE, "TEACHER"].includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Rotas apenas STUDENT (minhas turmas)
  if (pathname.startsWith("/minhas-turmas")) {
    if (role !== "STUDENT") {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // CMS Site e banners do tablet: Master e Admin.
  // O Admin não grava direto — as alterações entram na fila de aprovação do Master.
  if (pathname.startsWith("/admin/site") || pathname.startsWith("/admin/tablet")) {
    if (!PLATFORM_GOVERNANCE.includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Comunicação: disparo de SMS, e-mail e campanhas — Master e Administrador Geral
  if (
    pathname.startsWith("/admin/sms") ||
    pathname.startsWith("/admin/email") ||
    pathname.startsWith("/admin/campanhas")
  ) {
    if (!isMasterEquivalent) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Edição do onboarding, visão da plataforma, calendário institucional e acessos
  if (
    pathname.startsWith("/admin/onboarding") ||
    pathname.startsWith("/admin/plataforma") ||
    pathname.startsWith("/admin/calendario") ||
    pathname.startsWith("/master/acessos")
  ) {
    if (!PLATFORM_GOVERNANCE.includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Inscrições em eventos / feriados
  if (pathname.startsWith("/holidays")) {
    if (!PLATFORM_GOVERNANCE.includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/users/:path*",
    "/teachers/:path*",
    "/courses/:path*",
    "/class-groups/:path*",
    "/enrollments/:path*",
    "/students/:path*",
    "/minhas-turmas/:path*",
    "/admin/comunidade/:path*",
    "/admin/site/:path*",
    "/approvacoes/:path*",
    "/backup/:path*",
    "/meus-dados/:path*",
    "/minhas-indicacoes/:path*",
    "/trocar-senha/:path*",
    "/escolher-perfil/:path*",
    "/admin/polos/:path*",
    "/holidays/:path*",
    "/time-slots/:path*",
    "/professor/:path*",
    "/suporte/:path*",
    "/admin/sms/:path*",
    "/admin/email/:path*",
    "/admin/tablet/:path*",
    "/coordenacao/:path*",
    "/horarios/:path*",
    "/admin/forum/:path*",
    "/admin/frequencia/:path*",
    "/admin/avaliacoes-experiencia/:path*",
    "/admin/campanhas/:path*",
    "/gamificacao/:path*",
    "/ranking-alunos/:path*",
    "/onboarding/:path*",
    "/admin/onboarding/:path*",
    "/admin/plataforma/:path*",
    "/admin/calendario/:path*",
    "/master/acessos/:path*",
  ],
};
