"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";

type Item = { href: string; label: string; masterOnly?: boolean };

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/users", label: "Usuários (Admin)", masterOnly: true },
  { href: "/teachers", label: "Professores", masterOnly: true },
  { href: "/courses", label: "Cursos", masterOnly: true },
  { href: "/class-groups", label: "Turmas", masterOnly: true },
  { href: "/students", label: "Alunos (em breve)" },
];

export function Sidebar({
  user,
}: {
  user: { name: string; email: string; role: "MASTER" | "ADMIN" };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-4">
        <div className="text-sm font-semibold">Cadastro de Cursos</div>
        <div className="mt-2 text-xs text-zinc-600">{user.name}</div>
        <div className="text-xs text-zinc-500">{user.email}</div>
        <div className="mt-1 text-[11px] font-medium text-zinc-700">{user.role}</div>
      </div>

      <nav className="flex-1 px-2 py-3">
        <ul className="flex flex-col gap-1">
          {ITEMS.filter((i) => (i.masterOnly ? user.role === "MASTER" : true)).map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm ${
                    active ? "bg-zinc-900 text-white" : "text-zinc-800 hover:bg-zinc-100"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-zinc-200 p-3">
        <Button variant="secondary" className="w-full" onClick={logout} disabled={loading}>
          Sair
        </Button>
      </div>
    </aside>
  );
}
