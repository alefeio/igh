"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import type { ApiResponse } from "@/lib/api-types";
import {
  apimagesUploadHeaders,
  buildApimagesUploadFormData,
  parseApimagesUploadJson,
  readApiJson,
} from "@/lib/apimages-upload";
import {
  MAX_TEACHER_MATERIAL_BYTES,
  officePresentationEmbedUrl,
  type TeacherMaterialDto,
  type TeacherMaterialKind,
} from "@/lib/teacher-class-material";
import {
  Download,
  File,
  FileText,
  FolderOpen,
  Maximize2,
  Minimize2,
  Presentation,
  Trash2,
} from "lucide-react";

type MaterialItem = TeacherMaterialDto;

function formatBytes(size: number | null): string {
  if (size == null || size < 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function kindLabel(kind: TeacherMaterialKind): string {
  if (kind === "pdf") return "PDF";
  if (kind === "ppt") return "PowerPoint";
  return "Arquivo";
}

function KindIcon({ kind }: { kind: TeacherMaterialKind }) {
  const className = "h-4 w-4 shrink-0 text-[var(--igh-primary)]";
  if (kind === "pdf") return <FileText className={className} aria-hidden />;
  if (kind === "ppt") return <Presentation className={className} aria-hidden />;
  return <File className={className} aria-hidden />;
}

function fileHref(classGroupId: string, materialId: string, download: boolean): string {
  const base = `/api/teacher/class-groups/${classGroupId}/materials/${materialId}/file`;
  return download ? `${base}?download=1` : base;
}

function presentationSrc(classGroupId: string, material: MaterialItem): string {
  if (material.kind === "ppt") return officePresentationEmbedUrl(material.url);
  return `${fileHref(classGroupId, material.id, false)}#toolbar=1&navpanes=0&view=FitH`;
}

function MaterialViewer({
  classGroupId,
  material,
  ownerLabel,
  onClose,
}: {
  classGroupId: string;
  material: MaterialItem;
  ownerLabel?: string;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const [fullscreen, setFullscreen] = useState(false);
  const [frameReady, setFrameReady] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (document.fullscreenElement) {
        void document.exitFullscreen();
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  useEffect(() => {
    function onChange() {
      setFullscreen(document.fullscreenElement === rootRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    const root = rootRef.current;
    if (!root) return;
    try {
      if (document.fullscreenElement === root) {
        await document.exitFullscreen();
      } else {
        await root.requestFullscreen();
      }
    } catch {
      toast.push("error", "Este navegador não permitiu expandir a apresentação.");
    }
  };

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[80] flex flex-col bg-zinc-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`Apresentação: ${material.fileName}`}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{material.fileName}</p>
          <p className="text-xs text-zinc-400">
            {[ownerLabel, `${kindLabel(material.kind)} · apresentação`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15"
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
          {fullscreen ? "Reduzir" : "Expandir"}
        </button>
        <a
          href={fileHref(classGroupId, material.id, true)}
          download={material.fileName}
          className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15"
        >
          <Download className="h-4 w-4" aria-hidden />
          Baixar
        </a>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/10"
        >
          Fechar
        </button>
      </header>
      <div className="relative min-h-0 flex-1 bg-black">
        {!frameReady && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
            Abrindo apresentação…
          </p>
        )}
        <iframe
          title={material.fileName}
          src={presentationSrc(classGroupId, material)}
          className="h-full w-full border-0"
          allow="fullscreen"
          allowFullScreen
          onLoad={() => setFrameReady(true)}
        />
      </div>
    </div>
  );
}

function groupColleagueMaterials(items: MaterialItem[]): { ownerName: string; items: MaterialItem[] }[] {
  const groups: { ownerName: string; items: MaterialItem[] }[] = [];
  for (const item of items) {
    const ownerName = item.ownerName.trim() || "Professor";
    const current = groups[groups.length - 1];
    if (current && current.ownerName === ownerName) current.items.push(item);
    else groups.push({ ownerName, items: [item] });
  }
  return groups;
}

function MaterialList({
  materials,
  classGroupId,
  allowRemove,
  removingId,
  showClassLabel,
  onOpen,
  onRemove,
}: {
  materials: MaterialItem[];
  classGroupId: string;
  allowRemove: boolean;
  removingId: string | null;
  showClassLabel: boolean;
  onOpen: (material: MaterialItem) => void;
  onRemove: (material: MaterialItem) => void;
}) {
  return (
    <ul className="divide-y divide-[var(--card-border)] rounded-lg border border-[var(--card-border)]">
      {materials.map((material) => {
        const canPresent = material.kind === "pdf" || material.kind === "ppt";
        const meta = [
          material.lessonLabel,
          showClassLabel || !material.fromThisClass ? material.classLabel : "",
          kindLabel(material.kind),
          formatBytes(material.sizeBytes),
        ]
          .filter(Boolean)
          .join(" · ");
        const summary = (
          <>
            <KindIcon kind={material.kind} />
            <span className="min-w-0">
              <span className={`block truncate text-sm font-medium ${canPresent ? "text-[var(--igh-primary)]" : "text-[var(--text-primary)]"}`}>
                {material.fileName}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                {meta}
                {material.createdAt
                  ? ` · ${new Date(material.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
                  : ""}
              </span>
            </span>
          </>
        );
        return (
          <li key={material.id} className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center">
            {canPresent ? (
              <button
                type="button"
                className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left"
                onClick={() => onOpen(material)}
              >
                {summary}
              </button>
            ) : (
              <div className="flex min-w-0 flex-1 items-start gap-3">{summary}</div>
            )}
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {canPresent && (
                <button
                  type="button"
                  onClick={() => onOpen(material)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--igh-primary)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-95"
                >
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                  Abrir
                </button>
              )}
              <a
                href={fileHref(classGroupId, material.id, true)}
                download={material.fileName}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--card-border)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Baixar
              </a>
              {allowRemove && material.fromThisClass && (
                <button
                  type="button"
                  onClick={() => onRemove(material)}
                  disabled={removingId === material.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--card-border)] px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-[var(--igh-surface)] disabled:opacity-50 dark:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  {removingId === material.id ? "Removendo…" : "Remover"}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function TeacherClassMaterials({
  classGroupId,
  readOnly,
}: {
  classGroupId: string;
  readOnly: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [colleagues, setColleagues] = useState<MaterialItem[]>([]);
  const [lessons, setLessons] = useState<{ id: string; label: string }[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [panel, setPanel] = useState<"meus" | "outros">("meus");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ material: MaterialItem; shared: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/class-groups/${classGroupId}/materials`);
      const json = await readApiJson<{
        materials: MaterialItem[];
        colleagues: MaterialItem[];
        lessons: { id: string; label: string }[];
      }>(res);
      if (!res.ok || !json.ok) {
        setMaterials([]);
        setColleagues([]);
        setLessons([]);
        return;
      }
      setMaterials(json.data.materials);
      setColleagues(json.data.colleagues ?? []);
      setLessons(json.data.lessons ?? []);
    } catch {
      setMaterials([]);
      setColleagues([]);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  }, [classGroupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadOne = useCallback(
    async (file: File) => {
      if (file.size > MAX_TEACHER_MATERIAL_BYTES) {
        throw new Error("arquivo maior que 80 MB.");
      }
      const signRes = await fetch("/api/teacher/uploads/apimages-signature", { method: "POST" });
      const signJson = (await signRes.json()) as ApiResponse<{ uploadUrl: string; apiKey: string }>;
      if (!signRes.ok || !signJson.ok) {
        throw new Error(!signJson.ok ? signJson.error.message : "Falha ao preparar o envio.");
      }

      const uploadRes = await fetch(signJson.data.uploadUrl, {
        method: "POST",
        headers: apimagesUploadHeaders(signJson.data.apiKey),
        body: buildApimagesUploadFormData(file),
      });
      const parsed = parseApimagesUploadJson(await uploadRes.json().catch(() => null));
      if (!uploadRes.ok || parsed.errorMessage || !parsed.url) {
        throw new Error(parsed.errorMessage ?? "Falha no envio do arquivo.");
      }

      const persistRes = await fetch(`/api/teacher/class-groups/${classGroupId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: parsed.url,
          fileName: file.name,
          publicId: parsed.publicId || undefined,
          mimeType: file.type || undefined,
          sizeBytes: file.size,
          lessonId: lessonId || null,
        }),
      });
      const persistJson = await readApiJson<{ material: MaterialItem }>(persistRes);
      if (!persistRes.ok || !persistJson.ok) {
        throw new Error(!persistJson.ok ? persistJson.error.message : "Falha ao salvar o material.");
      }
      setMaterials((current) => [persistJson.data.material, ...current.filter((item) => item.id !== persistJson.data.material.id)]);
    },
    [classGroupId, lessonId]
  );

  const handleFiles = async (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;
    setUploading(true);
    let saved = 0;
    const errors: string[] = [];
    for (const file of files) {
      try {
        await uploadOne(file);
        saved += 1;
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : "falha no envio."}`);
      }
    }
    setUploading(false);
    if (saved > 0) {
      toast.push("success", saved === 1 ? "Material anexado." : `${saved} materiais anexados.`);
    }
    if (errors.length > 0) toast.push("error", errors[0] ?? "Falha ao anexar.");
  };

  const removeMaterial = async (material: MaterialItem) => {
    if (!window.confirm(`Remover "${material.fileName}" desta turma?`)) return;
    setRemovingId(material.id);
    try {
      const res = await fetch(`/api/teacher/class-groups/${classGroupId}/materials/${material.id}`, {
        method: "DELETE",
      });
      const json = await readApiJson<{ id: string }>(res);
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Não foi possível remover.");
        return;
      }
      setMaterials((current) => current.filter((item) => item.id !== material.id));
      if (viewing?.material.id === material.id) setViewing(null);
      toast.push("success", "Material removido.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPanel("meus");
          setOpen(true);
        }}
        data-tour="pt-material"
        className="inline-flex items-center gap-2 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
      >
        <FolderOpen className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
        Material do Professor
        {!loading && materials.length > 0 && (
          <span className="rounded-full bg-[var(--igh-primary)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {materials.length}
          </span>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Material do Professor">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Materiais da turma">
            <button
              type="button"
              role="tab"
              aria-selected={panel === "meus"}
              onClick={() => setPanel("meus")}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                panel === "meus"
                  ? "bg-[var(--igh-primary)] text-white"
                  : "bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
              }`}
            >
              Meus materiais
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={panel === "outros"}
              onClick={() => setPanel("outros")}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                panel === "outros"
                  ? "bg-[var(--igh-primary)] text-white"
                  : "bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
              }`}
            >
              Outros professores
              {colleagues.length > 0 ? ` (${colleagues.length})` : ""}
            </button>
          </div>

          {panel === "meus" ? (
            <>
              <p className="text-sm text-[var(--text-muted)]">
                Anexe PowerPoint, PDF ou outro arquivo para usar durante a aula. PDF e PowerPoint abrem em
                apresentação neste navegador. Arquivos que você anexou em outras turmas deste curso também
                aparecem aqui. Indique a aula do arquivo; pode deixar em branco.
              </p>
              {!readOnly && (
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
                    Aula
                    <select
                      value={lessonId}
                      onChange={(event) => setLessonId(event.target.value)}
                      className="rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm font-normal text-[var(--text-primary)]"
                    >
                      <option value="">Não informar</option>
                      {lessons.map((lesson) => (
                        <option key={lesson.id} value={lesson.id}>
                          {lesson.label}
                        </option>
                      ))}
                    </select>
                  </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[var(--igh-primary)]/40 bg-[var(--igh-primary)]/10 px-4 py-2 text-sm font-semibold text-[var(--igh-primary)] hover:bg-[var(--igh-primary)]/15">
                    <input
                      type="file"
                      multiple
                      className="sr-only"
                      disabled={uploading}
                      onChange={(event) => {
                        void handleFiles(event.target.files);
                        event.target.value = "";
                      }}
                    />
                    {uploading ? "Enviando…" : "Anexar arquivo"}
                  </label>
                  <span className="text-xs text-[var(--text-muted)]">Até 80 MB por arquivo.</span>
                </div>
                </div>
              )}
              {loading ? (
                <p className="text-sm text-[var(--text-muted)]">Carregando materiais…</p>
              ) : materials.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--card-border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                  {readOnly
                    ? "Nenhum material anexado pelo professor."
                    : "Nenhum material anexado ainda. Envie o PowerPoint ou o PDF da aula."}
                </p>
              ) : (
                <MaterialList
                  materials={materials}
                  classGroupId={classGroupId}
                  allowRemove={!readOnly}
                  removingId={removingId}
                  showClassLabel={false}
                  onOpen={(material) => setViewing({ material, shared: false })}
                  onRemove={(material) => void removeMaterial(material)}
                />
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--text-muted)]">
                Materiais de outros professores deste curso, em qualquer turma. Dá para abrir, expandir e baixar.
              </p>
              {loading ? (
                <p className="text-sm text-[var(--text-muted)]">Carregando materiais…</p>
              ) : colleagues.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--card-border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                  Nenhum outro professor anexou material neste curso.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {groupColleagueMaterials(colleagues).map((group) => (
                    <section key={group.ownerName} className="flex flex-col gap-2">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{group.ownerName}</h3>
                      <MaterialList
                        materials={group.items}
                        classGroupId={classGroupId}
                        allowRemove={false}
                        removingId={null}
                        showClassLabel
                        onOpen={(material) => setViewing({ material, shared: true })}
                        onRemove={() => undefined}
                      />
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {viewing && (viewing.material.kind === "pdf" || viewing.material.kind === "ppt") && (
        <MaterialViewer
          classGroupId={classGroupId}
          material={viewing.material}
          ownerLabel={viewing.shared ? viewing.material.ownerName : undefined}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}
