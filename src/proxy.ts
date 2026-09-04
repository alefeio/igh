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
  let isAdminManagerClaim = false;
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");
    const { payload } = await jwtVerify(token, secret);
    role = typeof payload.role === "string" ? payload.role : undefined;
    isAdminManagerClaim = payload.isAdminManager === true;
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname + (request.nextUrl.search || ""));
    return NextResponse.redirect(loginUrl);
  }

  const dashboardUrl = new URL("/dashboard", request.url);

  /** Administração pedagógica (sem Site/Comunicação). */
  const PEDAGOGICAL_GOVERNANCE = ["MASTER", "GENERAL_ADMIN", "ADMIN"];
  /** Site e Comunicação. */
  const SITE_AND_COMMS = ["MASTER", "GENERAL_ADMIN", "SITE_ADMIN"];
  /** Gerência Administrativa: pessoas, patrimônio, doações e financeiro (sem Diretor). */
  const ADMIN_MANAGEMENT = ["MASTER", "GENERAL_ADMIN", "ADMIN_MANAGER"];

  const isMasterEquivalent = role === "MASTER" || role === "GENERAL_ADMIN";

  if (["/users", "/backup", "/time-slots"].some((p) => pathname.startsWith(p))) {
    if (!isMasterEquivalent) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (pathname.startsWith("/approvacoes")) {
    if (!isMasterEquivalent) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (pathname.startsWith("/teachers")) {
    if (!PEDAGOGICAL_GOVERNANCE.includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (pathname.startsWith("/class-groups")) {
    if (![...PEDAGOGICAL_GOVERNANCE, "POLO_COORDINATOR"].includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (pathname.startsWith("/courses")) {
    if (![...PEDAGOGICAL_GOVERNANCE, "TEACHER"].includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (pathname.startsWith("/enrollments")) {
    if (![...PEDAGOGICAL_GOVERNANCE, "POLO_COORDINATOR", "TEACHER"].includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (pathname.startsWith("/admin/polos")) {
    if (!PEDAGOGICAL_GOVERNANCE.includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (pathname.startsWith("/students")) {
    if (![...PEDAGOGICAL_GOVERNANCE, "POLO_COORDINATOR", "TEACHER"].includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (
    pathname.startsWith("/admin/comunidade") ||
    pathname.startsWith("/admin/forum") ||
    pathname.startsWith("/admin/avaliacoes-experiencia")
  ) {
    if (!PEDAGOGICAL_GOVERNANCE.includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (pathname.startsWith("/gamificacao") || pathname.startsWith("/ranking-alunos")) {
    if (![...PEDAGOGICAL_GOVERNANCE, "TEACHER"].includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (pathname.startsWith("/minhas-turmas") || pathname.startsWith("/acesso-prova")) {
    if (role !== "STUDENT") {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // CMS Site e banners do tablet: Master, Admin Geral e Administrador Site
  if (pathname.startsWith("/admin/site") || pathname.startsWith("/admin/tablet")) {
    // Formações (catálogo) fica em Administração pedagógica
    if (pathname.startsWith("/admin/site/formacoes") && !pathname.includes("formacoes-pagina")) {
      if (!PEDAGOGICAL_GOVERNANCE.includes(role ?? "")) {
        return NextResponse.redirect(dashboardUrl);
      }
    } else if (!SITE_AND_COMMS.includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (
    pathname.startsWith("/admin/sms") ||
    pathname.startsWith("/admin/email") ||
    pathname.startsWith("/admin/campanhas")
  ) {
    if (!SITE_AND_COMMS.includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (
    pathname.startsWith("/admin/onboarding") ||
    pathname.startsWith("/admin/plataforma") ||
    pathname.startsWith("/admin/calendario") ||
    pathname.startsWith("/master/acessos")
  ) {
    if (!PEDAGOGICAL_GOVERNANCE.includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (pathname.startsWith("/holidays")) {
    if (!PEDAGOGICAL_GOVERNANCE.includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (pathname.startsWith("/admin/pre-inscricoes")) {
    const canViewPreInscricoes = [
      "MASTER",
      "GENERAL_ADMIN",
      "ADMIN",
      "SITE_ADMIN",
    ].includes(role ?? "");
    if (!canViewPreInscricoes) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (pathname.startsWith("/admin/gerencia")) {
    if ((role ?? "") === "DIRECTOR") {
      return NextResponse.redirect(dashboardUrl);
    }
    const canAccessGerencia =
      ADMIN_MANAGEMENT.includes(role ?? "") || isAdminManagerClaim;
    if (!canAccessGerencia) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (pathname.startsWith("/diretor")) {
    if (role !== "DIRECTOR" && role !== "MASTER") {
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
    "/acesso-prova/:path*",
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
    "/admin/pre-inscricoes/:path*",
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
    "/admin/gerencia/:path*",
    "/diretor/:path*",
  ],
};
