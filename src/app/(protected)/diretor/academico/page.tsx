import { redirect } from "next/navigation";

/** Acadêmico da Direção foi unificado na Coordenação pedagógica (evita duplicar o painel). */
export default function DiretorAcademicoRedirectPage() {
  redirect("/coordenacao/painel");
}
