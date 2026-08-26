import type {
  DonatariaZone,
  DonationKind,
  DonationStatus,
  InventoryCondition,
  InventoryMovementType,
} from "@/generated/prisma/client";
import { formatCentsBRL } from "@/lib/employees";

export const DONATION_KINDS: readonly DonationKind[] = ["BENS", "DINHEIRO", "MISTO"] as const;

export const DONATION_KIND_LABEL: Record<DonationKind, string> = {
  BENS: "Bens",
  DINHEIRO: "Dinheiro",
  MISTO: "Misto",
};

export const DONATION_STATUS_LABEL: Record<DonationStatus, string> = {
  RASCUNHO: "Rascunho",
  CONFIRMADA: "Confirmada",
  CANCELADA: "Cancelada",
};

export const DONATARIA_ZONES: readonly DonatariaZone[] = ["URBANA", "RURAL"] as const;

export const DONATARIA_ZONE_LABEL: Record<DonatariaZone, string> = {
  URBANA: "Urbana",
  RURAL: "Rural",
};

export const INVENTORY_CONDITIONS: readonly InventoryCondition[] = [
  "OTIMO",
  "BOM",
  "REGULAR",
  "RUIM",
] as const;

export const INVENTORY_CONDITION_LABEL: Record<InventoryCondition, string> = {
  OTIMO: "Ótimo",
  BOM: "Bom",
  REGULAR: "Regular",
  RUIM: "Ruim",
};

export const INVENTORY_MOVEMENT_TYPES: readonly InventoryMovementType[] = [
  "ENTRADA",
  "SAIDA",
  "AJUSTE",
] as const;

export const INVENTORY_MOVEMENT_LABEL: Record<InventoryMovementType, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  AJUSTE: "Ajuste",
};

export type InventoryItemView = {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  brand: string | null;
  model: string | null;
  assetTag: string | null;
  serialNumber: string | null;
  unit: string;
  minStock: number;
  location: string | null;
  responsibleName: string | null;
  condition: InventoryCondition;
  unitValueCents: number | null;
  photoUrl: string | null;
  photoPublicId: string | null;
  quantityOnHand: number;
  notes: string | null;
  isActive: boolean;
  lowStock: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DonatariaView = {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zone: DonatariaZone;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { donations: number };
};

export type DonationView = {
  id: string;
  donatariaId: string;
  donorInstitutionId: string | null;
  kind: DonationKind;
  donatedAt: string;
  description: string | null;
  amountCents: number | null;
  kitsCount: number;
  belongsTo: string | null;
  placeDateText: string | null;
  termNumber: number | null;
  status: DonationStatus;
  templateId: string | null;
  renderedHtml: string | null;
  pdfUrl: string | null;
  pdfPublicId: string | null;
  financialEntryId: string | null;
  inventoryPosted: boolean;
  createdAt: string;
  updatedAt: string;
  attachments?: Array<{
    id: string;
    url: string;
    publicId: string | null;
    fileName: string | null;
    description: string;
    kind: "GERADO" | "ASSINADO" | "OUTRO";
    createdAt: string;
  }>;
  donataria: {
    id: string;
    name: string;
    document: string | null;
    contactName: string | null;
    email?: string | null;
    phone?: string | null;
    city: string | null;
    state: string | null;
    zone?: DonatariaZone;
  };
  donorInstitution: {
    id: string;
    name: string | null;
    document: string | null;
    isDefault: boolean;
  } | null;
  template: { id: string; title: string; type: string } | null;
  financialEntry: { id: string; amountCents: number; description: string } | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
    inventoryItemId: string | null;
    inventoryItem: { id: string; name: string; quantityOnHand: number; unit: string } | null;
  }>;
};

export function formatDonationAmount(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return formatCentsBRL(cents);
}

export function formatDonationDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export { formatCentsBRL };
