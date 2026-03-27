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

  // Usuários, aprovações e backup: Master, Admin ou Coordenador (operações sensíveis no próprio handler)
  if (["/users", "/approvacoes", "/backup"].some((p) => pathname.startsWith(p))) {
    if (!["MASTER", "ADMIN", "COORDINATOR"].includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Professores e turmas (cadastro): Master, Admin ou Coordenador
  if (pathname.startsWith("/teachers") || pathname.startsWith("/class-groups")) {
    if (!["MASTER", "ADMIN", "COORDINATOR"].includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Cursos: Master, Admin, Coordenador ou Professor (professor vê apenas os cursos que leciona na UI/API)
  if (pathname.startsWith("/courses")) {
    if (!["MASTER", "ADMIN", "COORDINATOR", "TEACHER"].includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Matrículas: Master, Admin, Coordenador ou Professor
  if (pathname.startsWith("/enrollments")) {
    if (!["MASTER", "ADMIN", "COORDINATOR", "TEACHER"].includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Alunos: Master, Admin, Coordenador ou Professor
  if (pathname.startsWith("/students")) {
    if (!["MASTER", "ADMIN", "COORDINATOR", "TEACHER"].includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Rotas apenas STUDENT (minhas turmas)
  if (pathname.startsWith("/minhas-turmas")) {
    if (role !== "STUDENT") {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // CMS Site, campanhas e tablet: Master, Admin ou Coordenador
  if (
    pathname.startsWith("/admin/site") ||
    pathname.startsWith("/admin/sms") ||
    pathname.startsWith("/admin/email") ||
    pathname.startsWith("/admin/tablet")
  ) {
    if (!["MASTER", "ADMIN", "COORDINATOR"].includes(role ?? "")) {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Edição do onboarding: apenas Master e Admin
  if (pathname.startsWith("/admin/onboarding")) {
    if (!["MASTER", "ADMIN"].includes(role ?? "")) {
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
    "/admin/site/:path*",
    "/approvacoes/:path*",
    "/backup/:path*",
    "/meus-dados/:path*",
    "/trocar-senha/:path*",
    "/escolher-perfil/:path*",
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
    "/gamificacao/:path*",
    "/ranking-alunos/:path*",
    "/onboarding/:path*",
    "/admin/onboarding/:path*",
  ],
};
