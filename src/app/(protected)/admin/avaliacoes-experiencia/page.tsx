import { PlatformExperienceEvaluationsClient } from "@/components/platform-experience/PlatformExperienceEvaluationsClient";

export default function AdminAvaliacoesExperienciaPage() {
  return (
    <div className="min-w-0 py-2 sm:py-4">
      <PlatformExperienceEvaluationsClient
        apiUrl="/api/admin/platform-experience-feedback"
        pageTitle="Avaliações de experiência"
        pageDescription="Notas de 1 a 10 em plataforma, aulas e professor, além de comentários e indicações enviados pelos alunos. Visível para administradores."
      />
    </div>
  );
}
