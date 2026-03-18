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

  // Rotas apenas MASTER
  if (["/users", "/teachers", "/class-groups", "/approvacoes", "/backup"].some((p) => pathname.startsWith(p))) {
    if (role !== "MASTER") {
      const dashboardUrl = new URL("/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Cursos: MASTER ou TEACHER (professor vê apenas os cursos que leciona)
  if (pathname.startsWith("/courses")) {
    if (role !== "MASTER" && role !== "TEACHER") {
      const dashboardUrl = new URL("/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Matrículas: MASTER, ADMIN ou TEACHER (professor vê apenas as turmas que leciona)
  if (pathname.startsWith("/enrollments")) {
    if (role !== "MASTER" && role !== "ADMIN" && role !== "TEACHER") {
      const dashboardUrl = new URL("/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Alunos: MASTER, ADMIN ou TEACHER (professor vê apenas seus alunos)
  if (pathname.startsWith("/students")) {
    if (role !== "MASTER" && role !== "ADMIN" && role !== "TEACHER") {
      const dashboardUrl = new URL("/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Rotas apenas STUDENT (minhas turmas)
  if (pathname.startsWith("/minhas-turmas")) {
    if (role !== "STUDENT") {
      const dashboardUrl = new URL("/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Rotas CMS Site (apenas ADMIN e MASTER)
  if (pathname.startsWith("/admin/site")) {
    if (role !== "MASTER" && role !== "ADMIN") {
      const dashboardUrl = new URL("/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Campanhas SMS (apenas ADMIN e MASTER)
  if (pathname.startsWith("/admin/sms")) {
    if (role !== "MASTER" && role !== "ADMIN") {
      const dashboardUrl = new URL("/dashboard", request.url);
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
  ],
};
