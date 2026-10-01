"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import type { ApiResponse } from "@/lib/api-types";
import { DEPARTURE_REASON_LABEL } from "@/lib/coordinator/labels";
import type { DepartureReasonCode } from "@/lib/coordinator/types";

type Sheet = {
  enrollment: {
    id: string;
    status: string;
    isPreEnrollment: boolean;
    enrollmentConfirmedAt: string | null;
    enrolledAt: string;
    certificateEligible: boolean;
    student: { name: string; email: string | null; phone: string | null };
    classGroup: { course: { name: string }; teacher: { name: string }; startTime: string; status: string; cycle: { cycle: number; year: number } };
    historyEntries: { id: string; kind: string; body: string; createdAt: string; author: { name: string } }[];
    departures: { id: string; reason: DepartureReasonCode; note: string | null; recordedAt: string; recordedBy: { name: string } }[];
  } | null;
  interventions: { id: string; type: string; problem: string; action: string; status: string; resultNote: string | null; createdAt: string; owner: { name: string } }[];
};

export default function AlunoCoordenacaoPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Sheet | null>(null);
  const [reason, setReason] = useState<DepartureReasonCode>("OTHER");
  const [note, setNote] = useState("");

  useEffect(() => {
    void fetch(`/api/coordenacao/alunos/${params.id}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json: ApiResponse<Sheet>) => {
        if (json.ok) setData(json.data);
      });
  }, [params.id]);

  async function saveReason() {
    await fetch("/api/coordenacao/saida", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enrollmentId: params.id, reason, note }),
    });
    window.location.reload();
  }

  const enrollment = data?.enrollment;
  if (!enrollment) return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero eyebrow="Ficha" title={enrollment.student.name} description={`${enrollment.classGroup.course.name} · ${enrollment.classGroup.teacher.name} · ${enrollment.classGroup.startTime}`} />
      <SectionCard title="Situação" variant="elevated">
        <p className="text-sm text-[var(--text-secondary)]">Status {enrollment.status}. {enrollment.isPreEnrollment ? "Pré-matrícula. " : ""}{enrollment.enrollmentConfirmedAt ? "Confirmada. " : "Sem confirmação registrada. "}Certificado {enrollment.certificateEligible ? "apto" : "ainda não apto"}. Contato {enrollment.student.phone || "sem telefone"} · {enrollment.student.email || "sem e-mail"}.</p>
      </SectionCard>
      <SectionCard title="Motivo de saída" description="Um novo registro não apaga os anteriores." variant="elevated">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className="h-10 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2" value={reason} onChange={(event) => setReason(event.target.value as DepartureReasonCode)}>
            {Object.entries(DEPARTURE_REASON_LABEL).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
          <input className="h-10 flex-1 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Observação" />
          <button type="button" className="h-10 rounded-md bg-[var(--igh-primary)] px-3 text-white" onClick={() => void saveReason()}>Registrar</button>
        </div>
        <ul className="mt-3 space-y-1 text-sm text-[var(--text-secondary)]">
          {enrollment.departures.map((item) => <li key={item.id}>{DEPARTURE_REASON_LABEL[item.reason]} · {item.recordedBy.name} · {item.note || "sem observação"}</li>)}
        </ul>
      </SectionCard>
      <SectionCard title="Linha do tempo" variant="elevated">
        <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
          {enrollment.historyEntries.map((item) => <li key={item.id}>{item.author.name} · {item.kind} · {item.body}</li>)}
          {data?.interventions.map((item) => <li key={item.id}>{item.owner.name} · {item.problem} · {item.action} · {item.status}</li>)}
        </ul>
      </SectionCard>
    </div>
  );
}
