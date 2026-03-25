"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Tab = "email" | "cpf" | "guardian";

export default function EsqueciSenhaPage() {
  const toast = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("email");

  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const [cpfStep, setCpfStep] = useState<1 | 2>(1);
  const [cpf, setCpf] = useState("");
  const [cpfStepToken, setCpfStepToken] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [cpfLoading, setCpfLoading] = useState(false);

  const [gStep, setGStep] = useState<1 | 2>(1);
  const [guardianCpf, setGuardianCpf] = useState("");
  const [studentName, setStudentName] = useState("");
  const [gStepToken, setGStepToken] = useState("");
  const [gBirthDate, setGBirthDate] = useState("");
  const [gLoading, setGLoading] = useState(false);

  function switchTab(next: Tab) {
    setTab(next);
    setEmailSent(false);
    setCpfStep(1);
    setCpfStepToken("");
    setGStep(1);
    setGStepToken("");
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailLoading(true);
    setEmailSent(false);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.push("error", json?.error?.message ?? "Falha ao enviar.");
        return;
      }
      setEmailSent(true);
      toast.push("success", "Se o e-mail estiver cadastrado, você receberá o link.");
    } finally {
      setEmailLoading(false);
    }
  }

  async function cpfStep1(e: React.FormEvent) {
    e.preventDefault();
    setCpfLoading(true);
    try {
      const res = await fetch("/api/auth/recovery/cpf-step1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cpf }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.push("error", json?.error?.message ?? "Não foi possível continuar.");
        return;
      }
      if (json?.ok && json.data?.stepToken) {
        setCpfStepToken(json.data.stepToken);
        setCpfStep(2);
        toast.push("success", "Agora informe sua data de nascimento cadastrada.");
      }
    } finally {
      setCpfLoading(false);
    }
  }

  async function cpfStep2(e: React.FormEvent) {
    e.preventDefault();
    setCpfLoading(true);
    try {
      const res = await fetch("/api/auth/recovery/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stepToken: cpfStepToken, birthDate }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.push("error", json?.error?.message ?? "Dados não conferem.");
        return;
      }
      const token = json?.data?.resetToken as string | undefined;
      if (token) {
        toast.push("success", "Dados confirmados. Defina sua nova senha.");
        router.push(`/redefinir-senha?token=${encodeURIComponent(token)}`);
      }
    } finally {
      setCpfLoading(false);
    }
  }

  async function guardianStep1(e: React.FormEvent) {
    e.preventDefault();
    setGLoading(true);
    try {
      const res = await fetch("/api/auth/recovery/guardian-step1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guardianCpf, studentName }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.push("error", json?.error?.message ?? "Não foi possível continuar.");
        return;
      }
      if (json?.ok && json.data?.stepToken) {
        setGStepToken(json.data.stepToken);
        setGStep(2);
        toast.push("success", "Agora informe a data de nascimento do aluno (cadastro).");
      }
    } finally {
      setGLoading(false);
    }
  }

  async function guardianStep2(e: React.FormEvent) {
    e.preventDefault();
    setGLoading(true);
    try {
      const res = await fetch("/api/auth/recovery/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stepToken: gStepToken, birthDate: gBirthDate }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.push("error", json?.error?.message ?? "Dados não conferem.");
        return;
      }
      const token = json?.data?.resetToken as string | undefined;
      if (token) {
        toast.push("success", "Dados confirmados. Defina a nova senha.");
        router.push(`/redefinir-senha?token=${encodeURIComponent(token)}`);
      }
    } finally {
      setGLoading(false);
    }
  }

  const tabBtn =
    "rounded-lg px-3 py-2 text-sm font-medium transition sm:px-4 border border-transparent";
  const tabActive = "bg-[var(--igh-primary)] text-white shadow-sm";
  const tabIdle = "bg-[var(--igh-surface)] text-[var(--text-secondary)] hover:border-[var(--card-border)]";

  return (
    <div className="w-full max-w-md px-2 sm:px-0">
      <div className="mb-4 flex justify-center sm:mb-6">
        <img src="/images/logo.png" alt="Logo" className="h-16 w-auto object-contain sm:h-20" />
      </div>
      <div className="card w-full">
        <div className="card-header">
          <div className="text-lg font-semibold">Esqueci minha senha</div>
          <div className="mt-1 text-sm text-zinc-600">
            Escolha como recuperar: e-mail, CPF do aluno (com confirmação) ou dados do responsável.
          </div>
        </div>
        <div className="card-body space-y-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Forma de recuperação">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "email"}
              className={`${tabBtn} ${tab === "email" ? tabActive : tabIdle}`}
              onClick={() => switchTab("email")}
            >
              E-mail
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "cpf"}
              className={`${tabBtn} ${tab === "cpf" ? tabActive : tabIdle}`}
              onClick={() => switchTab("cpf")}
            >
              CPF do aluno
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "guardian"}
              className={`${tabBtn} ${tab === "guardian" ? tabActive : tabIdle}`}
              onClick={() => switchTab("guardian")}
            >
              Responsável
            </button>
          </div>

          {tab === "email" && (
            <>
              {emailSent ? (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-600">
                    Verifique sua caixa de entrada e o spam. O link expira em 24 horas.
                  </p>
                  <Link className="text-sm font-medium text-blue-600 underline" href="/login">
                    Voltar ao login
                  </Link>
                </div>
              ) : (
                <form className="flex flex-col gap-3" onSubmit={submitEmail}>
                  <p className="text-sm text-zinc-600">
                    Enviaremos um link seguro para o e-mail da sua conta (mesmo cadastrado no sistema).
                  </p>
                  <div>
                    <label className="text-sm font-medium">E-mail</label>
                    <div className="mt-1">
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="seu@email.com"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={emailLoading}>
                    {emailLoading ? "Enviando..." : "Enviar link"}
                  </Button>
                </form>
              )}
            </>
          )}

          {tab === "cpf" && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-600">
                Use o mesmo CPF com que você entra no sistema. Na sequência, confirme a{" "}
                <strong>data de nascimento</strong> cadastrada no seu perfil de aluno.
              </p>
              {cpfStep === 1 ? (
                <form className="flex flex-col gap-3" onSubmit={cpfStep1}>
                  <div>
                    <label className="text-sm font-medium">CPF do aluno</label>
                    <div className="mt-1">
                      <Input
                        value={cpf}
                        onChange={(e) => setCpf(e.target.value)}
                        inputMode="numeric"
                        autoComplete="username"
                        placeholder="Somente números"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={cpfLoading}>
                    {cpfLoading ? "Verificando..." : "Continuar"}
                  </Button>
                </form>
              ) : (
                <form className="flex flex-col gap-3" onSubmit={cpfStep2}>
                  <div>
                    <label className="text-sm font-medium">Data de nascimento</label>
                    <div className="mt-1">
                      <Input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        required
                      />
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">Deve ser exatamente a data do cadastro.</p>
                  </div>
                  <Button type="submit" disabled={cpfLoading}>
                    {cpfLoading ? "Validando..." : "Redefinir senha"}
                  </Button>
                  <button
                    type="button"
                    className="text-center text-sm text-zinc-600 underline"
                    onClick={() => {
                      setCpfStep(1);
                      setCpfStepToken("");
                      setBirthDate("");
                    }}
                  >
                    Voltar
                  </button>
                </form>
              )}
            </div>
          )}

          {tab === "guardian" && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-600">
                Para alunos <strong>sem CPF</strong> no cadastro ou menores: informe o CPF do{" "}
                <strong>responsável</strong> e o <strong>nome completo do aluno</strong> como está no cadastro. Depois, a data
                de nascimento do aluno.
              </p>
              {gStep === 1 ? (
                <form className="flex flex-col gap-3" onSubmit={guardianStep1}>
                  <div>
                    <label className="text-sm font-medium">CPF do responsável</label>
                    <div className="mt-1">
                      <Input
                        value={guardianCpf}
                        onChange={(e) => setGuardianCpf(e.target.value)}
                        inputMode="numeric"
                        placeholder="Somente números"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Nome completo do aluno</label>
                    <div className="mt-1">
                      <Input
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        autoComplete="name"
                        placeholder="Como consta no cadastro"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={gLoading}>
                    {gLoading ? "Verificando..." : "Continuar"}
                  </Button>
                </form>
              ) : (
                <form className="flex flex-col gap-3" onSubmit={guardianStep2}>
                  <div>
                    <label className="text-sm font-medium">Data de nascimento do aluno</label>
                    <div className="mt-1">
                      <Input
                        type="date"
                        value={gBirthDate}
                        onChange={(e) => setGBirthDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={gLoading}>
                    {gLoading ? "Validando..." : "Redefinir senha"}
                  </Button>
                  <button
                    type="button"
                    className="text-center text-sm text-zinc-600 underline"
                    onClick={() => {
                      setGStep(1);
                      setGStepToken("");
                      setGBirthDate("");
                    }}
                  >
                    Voltar
                  </button>
                </form>
              )}
            </div>
          )}

          <Link className="block text-center text-sm text-zinc-600 underline" href="/login">
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
