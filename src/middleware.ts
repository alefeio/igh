import { NextResponse, type NextRequest } from "next/server";

import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/setup", "/confirmar-inscricao", "/esqueci-senha", "/redefinir-senha"];
const AUTH_COOKIE_NAME = "auth_token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  let role: string | undefined;
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");
    const { payload } = await jwtVerify(token, secret);
    role = typeof payload.role === "string" ? payload.role : undefined;
  } catch {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Rotas apenas MASTER
  if (["/users", "/teachers", "/courses", "/class-groups", "/approvacoes"].some((p) => pathname.startsWith(p))) {
    if (role !== "MASTER") {
      const dashboardUrl = new URL("/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Rotas MASTER ou ADMIN (matrículas e alunos)
  if (pathname.startsWith("/enrollments") || pathname.startsWith("/students")) {
    if (role !== "MASTER" && role !== "ADMIN") {
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
  ],
};
