"use client";

import { useParams } from "next/navigation";
import { ProfessorExamEditor } from "@/components/professor/ProfessorExamEditor";

export default function NovaProvaPage() {
  const params = useParams();
  return (
    <div className="container-page py-4">
      <ProfessorExamEditor classGroupId={params.id as string} />
    </div>
  );
}
