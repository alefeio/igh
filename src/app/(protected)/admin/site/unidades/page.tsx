"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import { ApimagesImageUpload } from "@/components/admin/ApimagesImageUpload";

type CourseOption = { id: string; name: string; description?: string | null; slug: string };

type Unit = {
  id: string;
  slug: string;
  city: string;
  state: string;
  addressLine: string | null;
  locationName: string | null;
  whatsapp: string | null;
  heroBadge: string | null;
  heroTitle: string | null;
  heroText: string | null;
  heroImageUrl: string | null;
  benefitsBadge: string | null;
  benefitsTitle: string | null;
  benefitsText: string | null;
  benefitsBullets: string[];
  benefitsImageUrl: string | null;
  galleryImages: string[];
  isActive: boolean;
  courses: { course: { id: string; name: string; description: string | null } }[];
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function UnidadesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Unit[]>([]);
  const [allCourses, setAllCourses] = useState<CourseOption[]>([]);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);

  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("MA");
  const [addressLine, setAddressLine] = useState("");
  const [locationName, setLocationName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const [heroBadge, setHeroBadge] = useState("Cursos 100% gratuitos");
  const [heroTitle, setHeroTitle] = useState("Aprenda tecnologia na prática e transforme seu futuro.");
  const [heroText, setHeroText] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");

  const [benefitsBadge, setBenefitsBadge] = useState("Por que participar?");
  const [benefitsTitle, setBenefitsTitle] = useState("Capacitação gera oportunidades.");
  const [benefitsText, setBenefitsText] = useState("");
  const [benefitsBulletsText, setBenefitsBulletsText] = useState("Aulas práticas e diretas\nAmbiente de aprendizado acolhedor");
  const [benefitsImageUrl, setBenefitsImageUrl] = useState("");

  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [courseFilter, setCourseFilter] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);

  const benefitsBullets = useMemo(
    () =>
      benefitsBulletsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    [benefitsBulletsText]
  );

  const filteredCourses = useMemo(() => {
    const q = courseFilter.trim().toLowerCase();
    if (!q) return allCourses;
    return allCourses.filter((c) => c.name.toLowerCase().includes(q));
  }, [allCourses, courseFilter]);

  async function load() {
    setLoading(true);
    try {
      const [unitsRes, coursesRes] = await Promise.all([fetch("/api/admin/site/units"), fetch("/api/courses")]);
      const unitsJson = (await unitsRes.json()) as ApiResponse<{ items: Unit[] }>;
      const coursesJson = (await coursesRes.json().catch(() => null)) as ApiResponse<{ courses: CourseOption[] }> | null;
      if (!unitsRes.ok || !unitsJson.ok) {
        toast.push("error", !unitsJson.ok ? unitsJson.error?.message : "Falha ao carregar unidades.");
        return;
      }
      setItems(unitsJson.data.items);
      if (!coursesRes.ok || !coursesJson || !coursesJson.ok) {
        setAllCourses([]);
        toast.push(
          "error",
          coursesJson && "ok" in coursesJson && coursesJson.ok === false
            ? coursesJson.error.message
            : "Falha ao carregar cursos para seleção."
        );
      } else {
        setAllCourses(coursesJson.data.courses);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setEditing(null);
    setSlug("");
    setCity("");
    setState("MA");
    setAddressLine("");
    setLocationName("");
    setWhatsapp("");
    setHeroBadge("Cursos 100% gratuitos");
    setHeroTitle("Aprenda tecnologia na prática e transforme seu futuro.");
    setHeroText("");
    setHeroImageUrl("");
    setBenefitsBadge("Por que participar?");
    setBenefitsTitle("Capacitação gera oportunidades.");
    setBenefitsText("");
    setBenefitsBulletsText("Aulas práticas e diretas\nAmbiente de aprendizado acolhedor");
    setBenefitsImageUrl("");
    setGalleryImages([]);
    setIsActive(true);
    setCourseFilter("");
    setSelectedCourseIds([]);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(u: Unit) {
    setEditing(u);
    setSlug(u.slug);
    setCity(u.city);
    setState(u.state);
    setAddressLine(u.addressLine ?? "");
    setLocationName(u.locationName ?? "");
    setWhatsapp(u.whatsapp ?? "");
    setHeroBadge(u.heroBadge ?? "");
    setHeroTitle(u.heroTitle ?? "");
    setHeroText(u.heroText ?? "");
    setHeroImageUrl(u.heroImageUrl ?? "");
    setBenefitsBadge(u.benefitsBadge ?? "");
    setBenefitsTitle(u.benefitsTitle ?? "");
    setBenefitsText(u.benefitsText ?? "");
    setBenefitsBulletsText((u.benefitsBullets ?? []).join("\n"));
    setBenefitsImageUrl(u.benefitsImageUrl ?? "");
    setGalleryImages(u.galleryImages ?? []);
    setIsActive(u.isActive);
    setSelectedCourseIds(u.courses.map((c) => c.course.id));
    setOpen(true);
  }

  function onCityChange(v: string) {
    setCity(v);
    if (!editing && !slug.trim()) {
      const base = [v, locationName].map((s) => s.trim()).filter(Boolean).join(" ");
      const next = slugify(base || v);
      if (next) setSlug(next);
    }
  }

  function onLocationNameChange(v: string) {
    setLocationName(v);
    if (!editing && !slug.trim()) {
      const base = [city, v].map((s) => s.trim()).filter(Boolean).join(" ");
      const next = slugify(base);
      if (next) setSlug(next);
    }
  }

  async function save() {
    if (saving) return;
    if (!city.trim()) {
      toast.push("error", "Informe a cidade.");
      return;
    }
    if (!slug.trim()) {
      toast.push("error", "Informe o slug.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug: slug.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase().slice(0, 2),
        addressLine: addressLine.trim(),
        locationName: locationName.trim(),
        whatsapp: whatsapp.trim(),
        heroBadge: heroBadge.trim(),
        heroTitle: heroTitle.trim(),
        heroText: heroText.trim(),
        heroImageUrl: heroImageUrl.trim(),
        benefitsBadge: benefitsBadge.trim(),
        benefitsTitle: benefitsTitle.trim(),
        benefitsText: benefitsText.trim(),
        benefitsBullets,
        benefitsImageUrl: benefitsImageUrl.trim(),
        galleryImages,
        isActive,
        courseIds: selectedCourseIds,
      };

      const res = await fetch(editing ? `/api/admin/site/units/${editing.id}` : "/api/admin/site/units", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ApiResponse<{
        item?: Unit;
        pending?: boolean;
        message?: string;
      }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error?.message : "Falha ao salvar unidade.");
        return;
      }
      toast.push(
        "success",
        json.data.pending
          ? json.data.message ?? "Alteração enviada para aprovação do Master."
          : editing
            ? "Unidade atualizada."
            : "Unidade criada."
      );
      setOpen(false);
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function removeUnit(u: Unit) {
    if (!confirm(`Excluir a unidade "${u.city}/${u.state}"?`)) return;
    const res = await fetch(`/api/admin/site/units/${u.id}`, { method: "DELETE" });
    const json = (await res.json().catch(() => null)) as ApiResponse<{
      deleted?: boolean;
      pending?: boolean;
      message?: string;
    }> | null;
    if (!res.ok || !json?.ok) {
      toast.push("error", json && "ok" in json && json.ok === false ? json.error.message : "Falha ao excluir.");
      return;
    }
    toast.push(
      "success",
      json.data.pending
        ? json.data.message ?? "Exclusão enviada para aprovação do Master."
        : "Unidade excluída."
    );
    await load();
  }

  function addGalleryUrl(url: string) {
    const clean = url.trim();
    if (!clean) return;
    setGalleryImages((prev) => [...prev, clean]);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Unidades</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Configure dados de cada unidade para usar em landing pages (ex.: /codo).
          </p>
        </div>
        <Button onClick={openCreate}>Nova unidade</Button>
      </div>

      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Cidade</Th>
                <Th>UF</Th>
                <Th>Local</Th>
                <Th>Landing</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <Td className="font-semibold">{u.city}</Td>
                  <Td>{u.state}</Td>
                  <Td className="text-[var(--text-muted)]">{u.locationName ?? "—"}</Td>
                  <Td className="font-mono text-xs text-[var(--text-muted)]">/unidades/{u.slug}</Td>
                  <Td>{u.isActive ? "Ativa" : "Inativa"}</Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => openEdit(u)}>
                        Editar
                      </Button>
                      <Button variant="secondary" className="text-red-600 hover:text-red-700" onClick={() => void removeUnit(u)}>
                        Excluir
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="text-[var(--text-muted)]">
                    Nenhuma unidade cadastrada.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        )}
      </div>

      <Modal
        open={open}
        title={editing ? `Editar unidade (${city || editing.city}/${state || editing.state})` : "Nova unidade"}
        onClose={() => {
          if (saving) return;
          setOpen(false);
          resetForm();
        }}
      >
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Cidade *</label>
              <Input value={city} onChange={(e) => onCityChange(e.target.value)} placeholder="Codó" />
            </div>
            <div>
              <label className="text-sm font-medium">UF *</label>
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="MA" maxLength={2} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Slug *</label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="codo" />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                A página pública fica em <span className="font-mono">/unidades/seu-slug</span> (ex.:{" "}
                <span className="font-mono">/unidades/codo</span>). O slug antigo <span className="font-mono">/codo</span>{" "}
                redireciona para a mesma unidade.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Nome do local</label>
              <Input value={locationName} onChange={(e) => onLocationNameChange(e.target.value)} placeholder="Colégio Militar 2 de Julho - Espaço Maker" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Endereço</label>
              <Input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} placeholder="Rua X, nº Y, Bairro Z" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">WhatsApp</label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="5599991032924" />
              <p className="mt-1 text-xs text-[var(--text-muted)]">Use apenas números (com DDD e país).</p>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] p-4">
            <div className="text-sm font-semibold">Hero</div>
            <div className="mt-3 grid gap-3">
              <div>
                <label className="text-sm font-medium">Badge</label>
                <Input value={heroBadge} onChange={(e) => setHeroBadge(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Título</label>
                <Input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Texto</label>
                <textarea className="theme-input min-h-[90px] w-full rounded-md border px-3 py-2 text-sm" value={heroText} onChange={(e) => setHeroText(e.target.value)} />
              </div>
              <ApimagesImageUpload
                kind="about"
                label="Imagem do hero"
                currentUrl={heroImageUrl || undefined}
                onUploaded={(url) => setHeroImageUrl(url)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] p-4">
            <div className="text-sm font-semibold">Benefícios</div>
            <div className="mt-3 grid gap-3">
              <div>
                <label className="text-sm font-medium">Badge</label>
                <Input value={benefitsBadge} onChange={(e) => setBenefitsBadge(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Título</label>
                <Input value={benefitsTitle} onChange={(e) => setBenefitsTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Texto</label>
                <textarea className="theme-input min-h-[90px] w-full rounded-md border px-3 py-2 text-sm" value={benefitsText} onChange={(e) => setBenefitsText(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Lista (1 por linha)</label>
                <textarea className="theme-input min-h-[90px] w-full rounded-md border px-3 py-2 text-sm" value={benefitsBulletsText} onChange={(e) => setBenefitsBulletsText(e.target.value)} />
              </div>
              <ApimagesImageUpload
                kind="about"
                label="Imagem de benefícios"
                currentUrl={benefitsImageUrl || undefined}
                onUploaded={(url) => setBenefitsImageUrl(url)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] p-4">
            <div className="text-sm font-semibold">Galeria</div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Envie várias imagens ou cole URLs.</p>
            <div className="mt-3">
              <ApimagesImageUpload
                kind="about"
                label="Upload (múltiplas imagens)"
                multiple
                onUploaded={(url) => addGalleryUrl(url)}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <Input placeholder="https://..." onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const target = e.target as HTMLInputElement;
                  addGalleryUrl(target.value);
                  target.value = "";
                }
              }} />
            </div>
            {galleryImages.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {galleryImages.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-2">
                    <img src={url} alt="" className="h-14 w-14 rounded object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-[var(--text-muted)]">{url}</div>
                    </div>
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                      onClick={() => setGalleryImages((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhuma imagem na galeria ainda.</p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] p-4">
            <div className="text-sm font-semibold">Cursos exibidos na landing</div>
            <div className="mt-3">
              <Input value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} placeholder="Filtrar cursos…" />
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {filteredCourses.map((c) => {
                const checked = selectedCourseIds.includes(c.id);
                return (
                  <label key={c.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setSelectedCourseIds((prev) => (on ? [...prev, c.id] : prev.filter((id) => id !== c.id)));
                      }}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <div className="font-semibold text-[var(--text-primary)]">{c.name}</div>
                      {c.description ? <div className="text-xs text-[var(--text-muted)] line-clamp-2">{c.description}</div> : null}
                    </span>
                  </label>
                );
              })}
              {filteredCourses.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] sm:col-span-2">Nenhum curso encontrado.</p>
              ) : null}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Unidade ativa
          </label>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); resetForm(); }} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

