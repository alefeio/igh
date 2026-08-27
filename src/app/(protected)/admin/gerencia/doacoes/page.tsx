"use client";

import { Gift, MoreHorizontal, Plus, Search } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";

import { DashboardHero, PanelPageStack, SectionCard, StatTile } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import {
  apimagesUploadHeaders,
  buildApimagesUploadFormData,
  GERENCIA_UPLOAD_SIGNATURE,
  parseApimagesUploadJson,
  readApiJson,
} from "@/lib/apimages-upload";
import {
  DONATION_ATTACHMENT_KIND_LABEL,
  MAX_DONATION_ATTACHMENTS,
  resolveDonationPdfUrl,
  type DonationAttachmentKindValue,
} from "@/lib/donation-attachments";
import {
  DEFAULT_DONATION_KIT,
  describeDonationKit,
  expandDonationKitItems,
  mergeDonationItems,
  type DonationKitComponent,
} from "@/lib/donation-kits";
import type { DonationKind, DonationStatus } from "@/generated/prisma/client";
import type { DonorInstitutionView } from "@/lib/donor-institution-ui";
import {
  DONATION_KIND_LABEL,
  DONATION_KINDS,
  DONATION_STATUS_LABEL,
  formatDonationAmount,
  formatDonationDate,
  type DonatariaView,
  type DonationView,
  type InventoryItemView,
} from "@/lib/inventory-donations-ui";

type TemplateOption = { id: string; title: string; type: string; isActive: boolean };

type ExtraItem = {
  inventoryItemId: string;
  name: string;
  quantity: string;
  unit: string;
};

type FormAttachment = {
  key: string;
  url: string;
  publicId: string | null;
  fileName: string | null;
  description: string;
  kind: DonationAttachmentKindValue;
};

type DonatariaCandidate = {
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  zone: "URBANA" | "RURAL";
};

type FormState = {
  donorInstitutionId: string;
  donatariaId: string;
  kind: DonationKind;
  donatedAt: string;
  description: string;
  amount: string;
  kitsCount: number;
  belongsTo: string;
  placeDateText: string;
  templateId: string;
  generatePdf: boolean;
  confirmNow: boolean;
  postInventory: boolean;
  postFinancial: boolean;
  extras: ExtraItem[];
  attachments: FormAttachment[];
};

type TermReadResult = {
  suggestion: {
    donorName?: string;
    donatedAt?: string;
    placeDateText?: string;
    kitsCount?: number;
    belongsTo?: string;
    description?: string;
    donatariaName?: string;
    templateKind?: "IGH" | "INAC";
  };
  source: string;
  warnings: string[];
  matchedDonorInstitutionId: string | null;
  matchedDonatariaId: string | null;
  matchedTemplateId: string | null;
  donatariaCreateCandidate: DonatariaCandidate | null;
};

function emptyForm(): FormState {
  const today = new Date();
  const place = `Belém, ${today.getDate()} de ${today.toLocaleDateString("pt-BR", { month: "long" })} de ${today.getFullYear()}`;
  return {
    donorInstitutionId: "",
    donatariaId: "",
    kind: "BENS",
    donatedAt: today.toISOString().slice(0, 10),
    description: "",
    amount: "",
    kitsCount: 1,
    belongsTo: "",
    placeDateText: place,
    templateId: "",
    generatePdf: true,
    confirmNow: true,
    postInventory: true,
    postFinancial: true,
    extras: [],
    attachments: [],
  };
}

function statusTone(status: DonationStatus): "zinc" | "green" | "amber" | "red" {
  if (status === "CONFIRMADA") return "green";
  if (status === "RASCUNHO") return "amber";
  return "red";
}

function donationHasPdf(d: DonationView): boolean {
  return Boolean(
    resolveDonationPdfUrl({
      pdfUrl: d.pdfUrl,
      attachments: d.attachments ?? [],
    }),
  );
}

function toFormAttachments(d: DonationView): FormAttachment[] {
  return (d.attachments ?? []).map((a) => ({
    key: a.id,
    url: a.url,
    publicId: a.publicId,
    fileName: a.fileName,
    description: a.description,
    kind: a.kind,
  }));
}

function payloadAttachments(attachments: FormAttachment[]) {
  return attachments.map((a) => ({
    url: a.url,
    publicId: a.publicId,
    fileName: a.fileName,
    description: a.description,
    kind: a.kind,
  }));
}

const selectClass =
  "w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm";

const menuItemClass =
  "block w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)] disabled:opacity-50";

export default function DoacoesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [donations, setDonations] = useState<DonationView[]>([]);
  const [donatarias, setDonatarias] = useState<DonatariaView[]>([]);
  const [donors, setDonors] = useState<DonorInstitutionView[]>([]);
  const [inventory, setInventory] = useState<InventoryItemView[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [kitComponents, setKitComponents] = useState<DonationKitComponent[]>([
    ...DEFAULT_DONATION_KIT,
  ]);

  const kitDescription = useMemo(() => describeDonationKit(kitComponents), [kitComponents]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | DonationStatus>("");
  const [kindFilter, setKindFilter] = useState<"" | DonationKind>("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [attachmentsOnlyEdit, setAttachmentsOnlyEdit] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [readingTerm, setReadingTerm] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewDonation, setPreviewDonation] = useState<DonationView | null>(null);
  const [createDonataria, setCreateDonataria] = useState(false);
  const [donatariaCandidate, setDonatariaCandidate] = useState<DonatariaCandidate | null>(null);
  const [ocrNote, setOcrNote] = useState<string | null>(null);

  const [actionsMenuId, setActionsMenuId] = useState<string | null>(null);
  const [actionsMenuPos, setActionsMenuPos] = useState<{
    top: number;
    right: number;
    openUp: boolean;
  } | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (statusFilter) sp.set("status", statusFilter);
      if (kindFilter) sp.set("kind", kindFilter);

      const [dRes, donRes, donorRes, invRes, tplRes, eqRes] = await Promise.all([
        fetch(`/api/admin/gerencia/doacoes?${sp.toString()}`, { cache: "no-store" }),
        fetch("/api/admin/gerencia/donatarias", { cache: "no-store" }),
        fetch("/api/admin/gerencia/configuracoes-doadora", { cache: "no-store" }),
        fetch("/api/admin/gerencia/almoxarifado/itens", { cache: "no-store" }),
        fetch("/api/admin/gerencia/modelos", { cache: "no-store" }),
        fetch("/api/admin/gerencia/equipamentos", { cache: "no-store" }),
      ]);

      const dJson = (await dRes.json()) as ApiResponse<{ donations: DonationView[] }>;
      const donJson = (await donRes.json()) as ApiResponse<{ donatarias: DonatariaView[] }>;
      const donorJson = (await donorRes.json()) as ApiResponse<{ institutions: DonorInstitutionView[] }>;
      const invJson = (await invRes.json()) as ApiResponse<{ items: InventoryItemView[] }>;
      const tplJson = (await tplRes.json()) as ApiResponse<{ templates: TemplateOption[] }>;
      const eqJson = (await eqRes.json()) as ApiResponse<{
        kitComponents: DonationKitComponent[];
      }>;

      if (!dRes.ok || !dJson.ok) {
        toast.push("error", !dJson.ok ? dJson.error.message : "Falha ao carregar doações.");
        return;
      }
      setDonations(dJson.data.donations);
      if (donRes.ok && donJson.ok) {
        setDonatarias(donJson.data.donatarias.filter((d) => d.isActive));
      }
      if (donorRes.ok && donorJson.ok) {
        setDonors((donorJson.data.institutions ?? []).filter((d) => d.isActive));
      }
      if (invRes.ok && invJson.ok) {
        setInventory(invJson.data.items.filter((i) => i.isActive));
      }
      if (tplRes.ok && tplJson.ok) {
        setTemplates(tplJson.data.templates.filter((t) => t.type === "TERMO_DOACAO" && t.isActive));
      }
      if (eqRes.ok && eqJson.ok && eqJson.data.kitComponents.length > 0) {
        setKitComponents(eqJson.data.kitComponents);
      }
    } catch {
      toast.push("error", "Falha ao carregar doações.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, kindFilter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!actionsMenuId) return;
    function onDoc(e: MouseEvent) {
      if (actionsMenuRef.current?.contains(e.target as Node)) return;
      setActionsMenuId(null);
      setActionsMenuPos(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActionsMenuId(null);
        setActionsMenuPos(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [actionsMenuId]);

  const previewItems = useMemo(() => {
    const kitLines = expandDonationKitItems(form.kitsCount, kitComponents);
    const extras = form.extras
      .filter((e) => e.name.trim() && Number(e.quantity) > 0)
      .map((e) => ({
        name: e.name.trim(),
        quantity: Number(e.quantity),
        unit: e.unit || "UN",
        inventoryItemId: e.inventoryItemId || null,
      }));
    return mergeDonationItems(kitLines, extras);
  }, [form.kitsCount, form.extras, kitComponents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return donations;
    return donations.filter((d) => {
      const hay = `${d.donorInstitution?.name ?? ""} ${d.donataria.name} ${d.description ?? ""} ${d.belongsTo ?? ""} ${DONATION_KIND_LABEL[d.kind]}`.toLowerCase();
      return hay.includes(q);
    });
  }, [donations, search]);

  const counts = useMemo(() => {
    return {
      total: donations.length,
      rascunho: donations.filter((d) => d.status === "RASCUNHO").length,
      confirmada: donations.filter((d) => d.status === "CONFIRMADA").length,
    };
  }, [donations]);

  const actionsMenuDonation = actionsMenuId
    ? donations.find((d) => d.id === actionsMenuId) ?? null
    : null;

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setAttachmentsOnlyEdit(false);
    setCreateDonataria(false);
    setDonatariaCandidate(null);
    setOcrNote(null);
  }

  function openCreate() {
    const defaultDonor = donors.find((d) => d.isDefault) ?? donors[0];
    setEditingId(null);
    setAttachmentsOnlyEdit(false);
    setCreateDonataria(false);
    setDonatariaCandidate(null);
    setOcrNote(null);
    setForm({ ...emptyForm(), donorInstitutionId: defaultDonor?.id ?? "" });
    setFormOpen(true);
  }

  function openEdit(d: DonationView, attachmentsOnly = false) {
    const kitLines = expandDonationKitItems(d.kitsCount, kitComponents);
    const kitKeys = new Set(kitLines.map((i) => `${i.name.trim().toLowerCase()}|${i.quantity}`));
    const extras = d.items
      .filter((i) => !kitKeys.has(`${i.name.trim().toLowerCase()}|${i.quantity}`))
      .map((i) => ({
        inventoryItemId: i.inventoryItemId ?? "",
        name: i.name,
        quantity: String(i.quantity),
        unit: i.unit || "UN",
      }));

    setEditingId(d.id);
    setAttachmentsOnlyEdit(attachmentsOnly || d.status !== "RASCUNHO");
    setCreateDonataria(false);
    setDonatariaCandidate(null);
    setOcrNote(null);
    setForm({
      donorInstitutionId: d.donorInstitutionId ?? d.donorInstitution?.id ?? "",
      donatariaId: d.donatariaId,
      kind: d.kind,
      donatedAt: d.donatedAt.slice(0, 10),
      description: d.description ?? "",
      amount:
        d.amountCents != null
          ? (d.amountCents / 100).toFixed(2).replace(".", ",")
          : "",
      kitsCount: d.kitsCount,
      belongsTo: d.belongsTo ?? "",
      placeDateText: d.placeDateText ?? "",
      templateId: d.templateId ?? "",
      generatePdf: true,
      confirmNow: false,
      postInventory: true,
      postFinancial: true,
      extras,
      attachments: toFormAttachments(d),
    });
    setFormOpen(true);
  }

  function openActionsMenu(e: ReactMouseEvent<HTMLButtonElement>, id: string) {
    if (actionsMenuId === id) {
      setActionsMenuId(null);
      setActionsMenuPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const estimatedHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight && rect.top > estimatedHeight;
    setActionsMenuPos({
      top: openUp ? rect.top : rect.bottom,
      right: Math.max(8, window.innerWidth - rect.right),
      openUp,
    });
    setActionsMenuId(id);
  }

  function setExtra(index: number, patch: Partial<ExtraItem>) {
    setForm((prev) => {
      const extras = [...prev.extras];
      extras[index] = { ...extras[index], ...patch };
      return { ...prev, extras };
    });
  }

  function onPickExtraInventory(index: number, inventoryItemId: string) {
    const inv = inventory.find((i) => i.id === inventoryItemId);
    setExtra(index, {
      inventoryItemId,
      name: inv?.name ?? "",
      unit: inv?.unit ?? "UN",
    });
  }

  async function applyTermSuggestion(result: TermReadResult) {
    const s = result.suggestion;
    setForm((prev) => {
      const next = { ...prev };
      if (result.matchedDonorInstitutionId) {
        next.donorInstitutionId = result.matchedDonorInstitutionId;
      }
      if (result.matchedDonatariaId) {
        next.donatariaId = result.matchedDonatariaId;
      }
      if (result.matchedTemplateId) {
        next.templateId = result.matchedTemplateId;
      }
      if (s.donatedAt) next.donatedAt = s.donatedAt;
      if (s.placeDateText) next.placeDateText = s.placeDateText;
      if (s.kitsCount != null && s.kitsCount > 0) next.kitsCount = s.kitsCount;
      if (s.belongsTo) next.belongsTo = s.belongsTo;
      if (s.description && !prev.description.trim()) next.description = s.description;
      // Histórico já assinado: não regenerar PDF por padrão
      next.generatePdf = prev.attachments.some((a) => a.kind === "ASSINADO")
        ? false
        : prev.generatePdf;
      return next;
    });

    if (result.matchedDonatariaId) {
      setCreateDonataria(false);
      setDonatariaCandidate(null);
    } else if (result.donatariaCreateCandidate) {
      setDonatariaCandidate(result.donatariaCreateCandidate);
      setCreateDonataria(true);
    }

    const parts: string[] = [];
    if (result.source === "pdf") parts.push("Campos preenchidos a partir do texto do PDF.");
    else if (result.source === "ocr") parts.push("Campos sugeridos por OCR do PDF escaneado.");
    else if (result.source === "vision") parts.push("Campos sugeridos por leitura de imagem.");
    else parts.push("Poucos campos reconhecidos — revise o formulário.");
    if (result.warnings.length) parts.push(result.warnings.slice(0, 2).join(" "));
    setOcrNote(parts.join(" "));
    toast.push(
      "success",
      result.source === "partial"
        ? "Termo anexado. Revise e complete os campos."
        : "Termo lido — confira os campos preenchidos.",
    );
  }

  async function readSignedTerm(url: string, fileName: string | null) {
    setReadingTerm(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 75_000);
    try {
      const res = await fetch("/api/admin/gerencia/doacoes/ler-termo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentUrl: url, attachmentFileName: fileName }),
        signal: controller.signal,
      });
      const json = (await res.json()) as ApiResponse<TermReadResult>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao ler o termo.");
        return;
      }
      await applyTermSuggestion(json.data);
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      toast.push(
        "error",
        aborted
          ? "A leitura demorou demais. O anexo foi mantido — preencha os campos manualmente."
          : "Falha ao ler o termo.",
      );
    } finally {
      window.clearTimeout(timeoutId);
      setReadingTerm(false);
    }
  }

  async function uploadAttachment(file: File, kind: DonationAttachmentKindValue = "ASSINADO") {
    if (form.attachments.length >= MAX_DONATION_ATTACHMENTS) {
      toast.push("error", `No máximo ${MAX_DONATION_ATTACHMENTS} anexos por termo.`);
      return;
    }
    setUploading(true);
    try {
      const signRes = await fetch(GERENCIA_UPLOAD_SIGNATURE, { method: "POST" });
      const signJson = await readApiJson<{ uploadUrl: string; apiKey: string }>(signRes);
      if (!signRes.ok || !signJson.ok) {
        toast.push("error", !signJson.ok ? signJson.error.message : "Falha ao preparar upload.");
        return;
      }
      const uploadRes = await fetch(signJson.data.uploadUrl, {
        method: "POST",
        headers: apimagesUploadHeaders(signJson.data.apiKey),
        body: buildApimagesUploadFormData(file),
      });
      const cloud = parseApimagesUploadJson(await uploadRes.json());
      if (!uploadRes.ok || !cloud.url || !cloud.publicId) {
        toast.push("error", cloud.errorMessage ?? "Falha no upload.");
        return;
      }
      const fileName = cloud.originalFilename ?? file.name;
      const description =
        kind === "ASSINADO"
          ? "Termo assinado"
          : kind === "GERADO"
            ? "PDF gerado"
            : fileName;
      setForm((prev) => ({
        ...prev,
        attachments: [
          ...prev.attachments,
          {
            key: `${Date.now()}-${fileName}`,
            url: cloud.url!,
            publicId: cloud.publicId,
            fileName,
            description,
            kind,
          },
        ],
        generatePdf: kind === "ASSINADO" && !editingId ? false : prev.generatePdf,
      }));
      toast.push("success", "Anexo enviado.");
      if (kind === "ASSINADO" && !attachmentsOnlyEdit) {
        void readSignedTerm(cloud.url!, fileName);
      }
    } catch {
      toast.push("error", "Falha ao anexar arquivo.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (attachmentsOnlyEdit && editingId) {
      setSaving(true);
      try {
        const res = await fetch(`/api/admin/gerencia/doacoes/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attachments: payloadAttachments(form.attachments) }),
        });
        const json = (await res.json()) as ApiResponse<{ donation: DonationView }>;
        if (!res.ok || !json.ok) {
          toast.push("error", !json.ok ? json.error.message : "Falha ao salvar anexos.");
          return;
        }
        toast.push("success", "Anexos atualizados.");
        closeForm();
        void load();
      } catch {
        toast.push("error", "Falha ao salvar anexos.");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!form.donorInstitutionId) {
      toast.push("error", "Selecione a instituição doadora (quem doa).");
      return;
    }
    if (!form.donatariaId && !(createDonataria && donatariaCandidate)) {
      toast.push("error", "Selecione a donatária ou confirme o cadastro automático.");
      return;
    }
    const showGoods = form.kind === "BENS" || form.kind === "MISTO";
    if (showGoods && previewItems.length === 0) {
      toast.push("error", "Informe kits ou itens extras.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        donorInstitutionId: form.donorInstitutionId,
        kind: form.kind,
        donatedAt: form.donatedAt,
        description: form.description.trim() || null,
        amount: form.kind === "BENS" ? null : form.amount,
        kitsCount: showGoods ? form.kitsCount : 0,
        belongsTo: form.belongsTo.trim() || null,
        placeDateText: form.placeDateText.trim() || null,
        templateId: form.templateId || null,
        attachments: payloadAttachments(form.attachments),
        items: showGoods
          ? previewItems.map((i) => ({
              inventoryItemId: i.inventoryItemId,
              name: i.name,
              quantity: i.quantity,
              unit: i.unit,
            }))
          : [],
      };

      if (form.donatariaId) {
        payload.donatariaId = form.donatariaId;
      } else if (createDonataria && donatariaCandidate) {
        payload.createDonataria = donatariaCandidate;
      }

      if (!editingId) {
        payload.generatePdf = form.generatePdf;
        payload.confirmNow = form.confirmNow;
        payload.postInventory = form.postInventory;
        payload.postFinancial = form.postFinancial;
      }

      const res = await fetch(
        editingId ? `/api/admin/gerencia/doacoes/${editingId}` : "/api/admin/gerencia/doacoes",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = (await res.json()) as ApiResponse<{ donation: DonationView }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar doação.");
        return;
      }
      toast.push(
        "success",
        editingId
          ? "Rascunho atualizado."
          : form.confirmNow
            ? "Doação confirmada."
            : "Doação salva como rascunho.",
      );
      closeForm();
      void load();
    } catch {
      toast.push("error", "Falha ao salvar doação.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDonation(id: string) {
    setConfirmingId(id);
    setActionsMenuId(null);
    try {
      const res = await fetch(`/api/admin/gerencia/doacoes/${id}/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postInventory: true,
          postFinancial: true,
          generatePdf: true,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ donation: DonationView }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao confirmar.");
        return;
      }
      toast.push("success", "Doação confirmada.");
      void load();
    } catch {
      toast.push("error", "Falha ao confirmar.");
    } finally {
      setConfirmingId(null);
    }
  }

  async function archiveDonation(d: DonationView) {
    setActionsMenuId(null);
    const termLabel = d.termNumber != null ? `nº ${d.termNumber}` : "rascunho";
    const extra =
      d.status === "CONFIRMADA"
        ? " O termo some da lista; estoque e lançamento financeiro vinculados serão estornados/arquivados."
        : "";
    if (
      !confirm(
        `Excluir o termo ${termLabel} para ${d.donataria.name}?${extra} Esta ação não pode ser desfeita com um clique.`,
      )
    ) {
      return;
    }
    setDeletingId(d.id);
    try {
      const res = await fetch(`/api/admin/gerencia/doacoes/${d.id}`, { method: "DELETE" });
      const json = (await res.json()) as ApiResponse<{ archived: boolean }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao excluir.");
        return;
      }
      toast.push("success", "Termo excluído.");
      void load();
    } catch {
      toast.push("error", "Falha ao excluir.");
    } finally {
      setDeletingId(null);
    }
  }

  const showItems = form.kind === "BENS" || form.kind === "MISTO";
  const showAmount = form.kind === "DINHEIRO" || form.kind === "MISTO";
  const fieldsLocked = attachmentsOnlyEdit;

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Gerência"
        title="Doações"
        description="O termo registra a doação de uma instituição (doadora) para outra (donatária). Escolha as duas partes ao criar."
        rightSlot={
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Novo termo
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Total" value={loading ? "—" : counts.total} icon={Gift} />
        <StatTile
          label="Rascunhos"
          value={loading ? "—" : counts.rascunho}
          icon={Gift}
          accent="amber"
        />
        <StatTile
          label="Confirmadas"
          value={loading ? "—" : counts.confirmada}
          icon={Gift}
          accent="emerald"
        />
      </div>

      <SectionCard title="Histórico de termos" description="Doações de saída registradas." variant="elevated">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              className="pl-9"
              placeholder="Buscar doadora, donatária, pertence a…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className={selectClass + " w-auto"}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | DonationStatus)}
          >
            <option value="">Todos os status</option>
            <option value="RASCUNHO">Rascunho</option>
            <option value="CONFIRMADA">Confirmada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
          <select
            className={selectClass + " w-auto"}
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as "" | DonationKind)}
          >
            <option value="">Todos os tipos</option>
            {DONATION_KINDS.map((k) => (
              <option key={k} value={k}>
                {DONATION_KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar"}
          </Button>
        </div>

        <Table>
          <thead>
            <tr>
              <Th>Nº</Th>
              <Th>Data</Th>
              <Th>Doadora</Th>
              <Th>Donatária</Th>
              <Th>Kits / itens</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id}>
                <Td className="whitespace-nowrap font-medium">
                  {d.termNumber != null ? `#${d.termNumber}` : "—"}
                </Td>
                <Td className="whitespace-nowrap">{formatDonationDate(d.donatedAt)}</Td>
                <Td>
                  <div className="font-medium">{d.donorInstitution?.name || "—"}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {d.donorInstitution?.document || "Quem doa"}
                  </div>
                </Td>
                <Td>
                  <div className="font-medium">{d.donataria.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {d.donataria.document || d.belongsTo || "—"}
                  </div>
                </Td>
                <Td>
                  {d.kitsCount > 0 ? (
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      {d.kitsCount} kit{d.kitsCount === 1 ? "" : "s"}
                    </span>
                  ) : (
                    formatDonationAmount(d.amountCents)
                  )}
                  {d.items.length > 0 ? (
                    <div className="text-xs text-[var(--text-muted)]">
                      {d.items
                        .slice(0, 3)
                        .map((i) => `${i.quantity} ${i.name}`)
                        .join("; ")}
                      {d.items.length > 3 ? "…" : ""}
                    </div>
                  ) : null}
                  {(d.attachments?.length ?? 0) > 0 ? (
                    <div className="text-xs text-[var(--text-muted)]">
                      {d.attachments!.length} anexo{d.attachments!.length === 1 ? "" : "s"}
                    </div>
                  ) : null}
                </Td>
                <Td>
                  <Badge tone={statusTone(d.status)}>{DONATION_STATUS_LABEL[d.status]}</Badge>
                </Td>
                <Td className="text-right">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-haspopup="menu"
                    aria-expanded={actionsMenuId === d.id}
                    onClick={(e) => openActionsMenu(e, d.id)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Ações</span>
                  </Button>
                </Td>
              </tr>
            ))}
            {!loading && filtered.length === 0 ? (
              <tr>
                <Td colSpan={7}>
                  <div className="flex flex-col items-center gap-3 py-8">
                    <p className="text-center text-sm text-[var(--text-muted)]">
                      Nenhuma doação encontrada.
                    </p>
                    <Button onClick={openCreate}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Criar primeiro termo
                    </Button>
                  </div>
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </SectionCard>

      {actionsMenuDonation &&
        actionsMenuPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={actionsMenuRef}
            role="menu"
            className="fixed z-50 min-w-[12.5rem] rounded-md border border-[var(--card-border)] bg-white py-1 shadow-lg dark:bg-zinc-900"
            style={
              actionsMenuPos.openUp
                ? {
                    bottom: window.innerHeight - actionsMenuPos.top + 4,
                    right: actionsMenuPos.right,
                  }
                : {
                    top: actionsMenuPos.top + 4,
                    right: actionsMenuPos.right,
                  }
            }
          >
            {donationHasPdf(actionsMenuDonation) ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClass}
                  onClick={() => {
                    setPreviewDonation(actionsMenuDonation);
                    setActionsMenuId(null);
                  }}
                >
                  Visualizar
                </button>
                <a
                  role="menuitem"
                  className={menuItemClass}
                  href={`/api/admin/gerencia/doacoes/${actionsMenuDonation.id}/pdf?download=1`}
                  onClick={() => setActionsMenuId(null)}
                >
                  Baixar PDF
                </a>
              </>
            ) : null}
            {actionsMenuDonation.status === "RASCUNHO" ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClass}
                  onClick={() => {
                    setActionsMenuId(null);
                    openEdit(actionsMenuDonation, false);
                  }}
                >
                  Editar termo
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClass}
                  disabled={confirmingId === actionsMenuDonation.id}
                  onClick={() => void confirmDonation(actionsMenuDonation.id)}
                >
                  {confirmingId === actionsMenuDonation.id ? "Confirmando…" : "Confirmar"}
                </button>
              </>
            ) : (
              <button
                type="button"
                role="menuitem"
                className={menuItemClass}
                onClick={() => {
                  setActionsMenuId(null);
                  openEdit(actionsMenuDonation, true);
                }}
              >
                Editar termo / anexos
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => {
                setActionsMenuId(null);
                openEdit(actionsMenuDonation, actionsMenuDonation.status !== "RASCUNHO");
              }}
            >
              Gerenciar anexos
            </button>
            <button
              type="button"
              role="menuitem"
              className={`${menuItemClass} text-red-600 dark:text-red-400`}
              disabled={deletingId === actionsMenuDonation.id}
              onClick={() => void archiveDonation(actionsMenuDonation)}
            >
              {deletingId === actionsMenuDonation.id ? "Excluindo…" : "Excluir termo"}
            </button>
          </div>,
          document.body,
        )}

      <Modal
        open={previewDonation != null}
        title={
          previewDonation?.termNumber != null
            ? `Termo nº ${previewDonation.termNumber}`
            : "Termo de doação"
        }
        onClose={() => setPreviewDonation(null)}
        size="large"
      >
        {previewDonation ? (
          <div className="space-y-3">
            {(previewDonation.attachments?.length ?? 0) > 1 ? (
              <div className="flex flex-wrap gap-2">
                {previewDonation.attachments!.map((a) => (
                  <a
                    key={a.id}
                    href={`/api/admin/gerencia/doacoes/${previewDonation.id}/pdf?attachmentId=${a.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-[var(--card-border)] px-2 py-1 text-xs hover:bg-[var(--igh-surface)]"
                  >
                    {a.description || DONATION_ATTACHMENT_KIND_LABEL[a.kind]}
                  </a>
                ))}
              </div>
            ) : null}
            <iframe
              title={
                previewDonation.termNumber != null
                  ? `Termo nº ${previewDonation.termNumber}`
                  : "Termo de doação"
              }
              src={`/api/admin/gerencia/doacoes/${previewDonation.id}/pdf`}
              className="h-[75vh] w-full rounded-md border border-[var(--card-border)] bg-white"
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={
          editingId
            ? attachmentsOnlyEdit
              ? "Editar termo / anexos"
              : "Editar rascunho de doação"
            : "Novo termo de doação"
        }
      >
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto sm:grid-cols-2">
          {!editingId ? (
            <div className="sm:col-span-2 space-y-2 rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-3">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Termo já assinado (histórico)
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Anexe o PDF/imagem do termo impresso e assinado. Tentamos reconhecer doadora,
                donatária, data e kits para preencher o formulário.
              </p>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="text-xs"
                  disabled={uploading || readingTerm}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void uploadAttachment(file, "ASSINADO");
                  }}
                />
              </label>
              {uploading || readingTerm ? (
                <p className="text-xs text-[var(--text-muted)]">
                  {uploading ? "Enviando arquivo…" : "Lendo termo…"}
                </p>
              ) : null}
              {ocrNote ? <p className="text-xs text-[var(--text-muted)]">{ocrNote}</p> : null}
            </div>
          ) : null}

          {donatariaCandidate && !form.donatariaId ? (
            <div className="sm:col-span-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm dark:border-amber-700/50 dark:bg-amber-950/30">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={createDonataria}
                  onChange={(e) => setCreateDonataria(e.target.checked)}
                />
                <span>
                  Donatária <strong>{donatariaCandidate.name}</strong>
                  {donatariaCandidate.document ? ` (${donatariaCandidate.document})` : ""} não
                  cadastrada. Cadastrar automaticamente ao salvar?
                  <span className="mt-1 block text-xs text-[var(--text-muted)]">
                    Revise os dados antes de confirmar — o cadastro usa o que foi extraído do
                    termo.
                  </span>
                </span>
              </label>
            </div>
          ) : null}

          <div className="sm:col-span-2 rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm text-[var(--text-muted)]">
            <p className="font-medium text-[var(--text-primary)]">Quem participa do termo</p>
            <p className="mt-1">
              <strong>Doadora</strong> é quem entrega os bens ou o valor.{" "}
              <strong>Donatária</strong> é a entidade que recebe.
            </p>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm">Doadora (quem doa)</span>
            <select
              className={selectClass}
              value={form.donorInstitutionId}
              disabled={fieldsLocked}
              onChange={(e) => setForm((f) => ({ ...f, donorInstitutionId: e.target.value }))}
            >
              <option value="">Selecione a doadora…</option>
              {donors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.isDefault ? " (padrão)" : ""}
                </option>
              ))}
            </select>
            <Link
              href="/admin/gerencia/configuracoes-doadora"
              target="_blank"
              className="mt-1 inline-block text-xs text-[var(--igh-primary)] hover:underline"
            >
              Cadastrar outra doadora
            </Link>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Donatária (quem recebe)</span>
            <select
              className={selectClass}
              value={form.donatariaId}
              disabled={fieldsLocked}
              onChange={(e) => {
                setForm((f) => ({ ...f, donatariaId: e.target.value }));
                if (e.target.value) {
                  setCreateDonataria(false);
                }
              }}
            >
              <option value="">
                {createDonataria && donatariaCandidate
                  ? `Nova: ${donatariaCandidate.name}`
                  : "Selecione a donatária…"}
              </option>
              {donatarias.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <Link
              href="/admin/gerencia/donatarias"
              target="_blank"
              className="mt-1 inline-block text-xs text-[var(--igh-primary)] hover:underline"
            >
              Cadastrar donatária
            </Link>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Tipo</span>
            <select
              className={selectClass}
              value={form.kind}
              disabled={fieldsLocked}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as DonationKind }))}
            >
              {DONATION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {DONATION_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Data</span>
            <Input
              type="date"
              value={form.donatedAt}
              disabled={fieldsLocked}
              onChange={(e) => setForm((f) => ({ ...f, donatedAt: e.target.value }))}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Pertence a</span>
            <Input
              placeholder="Pessoa, político ou entidade"
              value={form.belongsTo}
              disabled={fieldsLocked}
              onChange={(e) => setForm((f) => ({ ...f, belongsTo: e.target.value }))}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Local e data por extenso</span>
            <Input
              value={form.placeDateText}
              disabled={fieldsLocked}
              onChange={(e) => setForm((f) => ({ ...f, placeDateText: e.target.value }))}
            />
          </label>
          {showAmount ? (
            <label className="block">
              <span className="mb-1 block text-sm">Valor (R$)</span>
              <Input
                placeholder="0,00"
                value={form.amount}
                disabled={fieldsLocked}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </label>
          ) : null}
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Descrição</span>
            <Input
              value={form.description}
              disabled={fieldsLocked}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Modelo do termo</span>
            <select
              className={selectClass}
              value={form.templateId}
              disabled={fieldsLocked}
              onChange={(e) => setForm((f) => ({ ...f, templateId: e.target.value }))}
            >
              <option value="">Usar o mais recente (se houver)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>

          {showItems && !fieldsLocked ? (
            <div className="sm:col-span-2 space-y-3 rounded-md border border-[var(--card-border)] p-3">
              <p className="text-sm text-[var(--text-muted)]">
                Cada kit contém: {kitDescription}.
              </p>
              <label className="flex flex-wrap items-center gap-3 text-sm">
                <span>Quantidade de kits</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, kitsCount: Math.max(0, f.kitsCount - 1) }))
                    }
                  >
                    −
                  </Button>
                  <Input
                    className="w-20 text-center"
                    type="number"
                    min={0}
                    value={form.kitsCount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, kitsCount: Math.max(0, Number(e.target.value) || 0) }))
                    }
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, kitsCount: f.kitsCount + 1 }))}
                  >
                    +
                  </Button>
                </div>
              </label>

              <Table>
                <thead>
                  <tr>
                    <Th>Item</Th>
                    <Th>Qtd</Th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((item, idx) => (
                    <tr key={`${item.name}-${idx}`}>
                      <Td>{item.name}</Td>
                      <Td>{String(item.quantity).padStart(2, "0")}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Itens extras</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        extras: [
                          ...f.extras,
                          { inventoryItemId: "", name: "", quantity: "1", unit: "UN" },
                        ],
                      }))
                    }
                  >
                    + Extra
                  </Button>
                </div>
                {form.extras.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid gap-2 rounded-md border border-[var(--card-border)] p-2 sm:grid-cols-4"
                  >
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-xs text-[var(--text-muted)]">Do estoque</span>
                      <select
                        className={selectClass}
                        value={item.inventoryItemId}
                        onChange={(e) => onPickExtraInventory(idx, e.target.value)}
                      >
                        <option value="">Livre</option>
                        {inventory.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.name} (saldo {inv.quantityOnHand})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-xs text-[var(--text-muted)]">Nome</span>
                      <Input
                        value={item.name}
                        onChange={(e) => setExtra(idx, { name: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-[var(--text-muted)]">Qtd</span>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => setExtra(idx, { quantity: e.target.value })}
                      />
                    </label>
                    <div className="flex items-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            extras: f.extras.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="sm:col-span-2 space-y-2 rounded-md border border-[var(--card-border)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Anexos do termo</p>
                <p className="text-xs text-[var(--text-muted)]">
                  PDF gerado e cópias assinadas/escaneadas (até {MAX_DONATION_ATTACHMENTS}).
                </p>
              </div>
              {form.attachments.length < MAX_DONATION_ATTACHMENTS ? (
                <label className="inline-flex cursor-pointer">
                  <span className="rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-2.5 py-1.5 text-xs font-medium">
                    {uploading ? "Enviando…" : "+ Anexar arquivo"}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void uploadAttachment(file, "ASSINADO");
                    }}
                  />
                </label>
              ) : null}
            </div>
            {form.attachments.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">Nenhum anexo ainda.</p>
            ) : (
              <ul className="space-y-2">
                {form.attachments.map((a) => (
                  <li
                    key={a.key}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--card-border)] px-2 py-2 text-sm"
                  >
                    <select
                      className={selectClass + " w-auto max-w-[10rem]"}
                      value={a.kind}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          attachments: prev.attachments.map((item) =>
                            item.key === a.key
                              ? {
                                  ...item,
                                  kind: e.target.value as DonationAttachmentKindValue,
                                  description:
                                    DONATION_ATTACHMENT_KIND_LABEL[
                                      e.target.value as DonationAttachmentKindValue
                                    ],
                                }
                              : item,
                          ),
                        }))
                      }
                    >
                      <option value="ASSINADO">Termo assinado</option>
                      <option value="GERADO">PDF gerado</option>
                      <option value="OUTRO">Outro</option>
                    </select>
                    <Input
                      className="min-w-[8rem] flex-1"
                      value={a.description}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          attachments: prev.attachments.map((item) =>
                            item.key === a.key
                              ? { ...item, description: e.target.value }
                              : item,
                          ),
                        }))
                      }
                    />
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[var(--igh-primary)] hover:underline"
                    >
                      {a.fileName || "Abrir"}
                    </a>
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          attachments: prev.attachments.filter((item) => item.key !== a.key),
                        }))
                      }
                    >
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!editingId ? (
            <>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.confirmNow}
                  onChange={(e) => setForm((f) => ({ ...f, confirmNow: e.target.checked }))}
                />
                Confirmar agora (baixa estoque / financeiro / PDF)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.generatePdf}
                  onChange={(e) => setForm((f) => ({ ...f, generatePdf: e.target.checked }))}
                />
                Gerar PDF do termo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.postInventory}
                  onChange={(e) => setForm((f) => ({ ...f, postInventory: e.target.checked }))}
                />
                Baixar estoque (itens com vínculo)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.postFinancial}
                  onChange={(e) => setForm((f) => ({ ...f, postFinancial: e.target.checked }))}
                />
                Lançar no financeiro
              </label>
            </>
          ) : fieldsLocked ? (
            <p className="text-sm text-[var(--text-muted)] sm:col-span-2">
              Termo confirmado: você pode gerenciar anexos (ex.: cópia assinada). Os demais dados
              do rascunho não são alterados aqui.
            </p>
          ) : (
            <p className="text-sm text-[var(--text-muted)] sm:col-span-2">
              Após salvar o rascunho, use <strong>Confirmar</strong> no menu de ações para gerar
              PDF e baixar estoque/financeiro.
            </p>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={closeForm}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || uploading || readingTerm}>
            {saving
              ? "Salvando…"
              : editingId
                ? attachmentsOnlyEdit
                  ? "Salvar anexos"
                  : "Salvar rascunho"
                : form.confirmNow
                  ? "Criar e confirmar"
                  : "Salvar rascunho"}
          </Button>
        </div>
      </Modal>
    </PanelPageStack>
  );
}
