import { permanentRedirect } from "next/navigation";

/** URL canônica da landing: `/unidades/[slug]` (ex.: `/unidades/codo`). */
export default function CodoLegacyRedirect() {
  permanentRedirect("/unidades/codo");
}
