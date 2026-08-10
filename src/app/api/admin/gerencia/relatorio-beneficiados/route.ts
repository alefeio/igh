import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

function addressLine(d: {
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
}) {
  return [
    d.street,
    d.number,
    d.neighborhood,
    d.city && d.state ? `${d.city}/${d.state}` : d.city || d.state,
    d.cep,
  ]
    .filter(Boolean)
    .join(", ");
}

export async function GET(request: Request) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const belongsTo = searchParams.get("belongsTo")?.trim() ?? "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const donations = await prisma.donation.findMany({
    where: {
      deletedAt: null,
      status: "CONFIRMADA",
      ...(belongsTo && belongsTo !== "Todos"
        ? { belongsTo: { equals: belongsTo, mode: "insensitive" } }
        : {}),
      ...(from || to
        ? {
            donatedAt: {
              ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ donatedAt: "asc" }, { termNumber: "asc" }],
    include: {
      donataria: true,
      items: true,
    },
  });

  const belongsToOptions = Array.from(
    new Set(
      donations
        .map((d) => d.belongsTo?.trim())
        .filter((v): v is string => Boolean(v)),
    ),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  let rows = donations.map((d) => {
    const quantity =
      d.kitsCount > 0
        ? d.kitsCount
        : d.items.reduce((sum, i) => sum + i.quantity, 0);
    const equipmentText = d.items.map((i) => `${i.quantity} ${i.name}`).join("; ");
    const entity = d.donataria.document
      ? `${d.donataria.name} / CNPJ: ${d.donataria.document}`
      : d.donataria.name;

    return {
      id: d.id,
      termNumber: d.termNumber,
      donatedAt: d.donatedAt.toISOString().slice(0, 10),
      belongsTo: d.belongsTo,
      municipality: d.donataria.city ?? "",
      quantity,
      entity,
      address: addressLine(d.donataria),
      responsible: d.donataria.contactName ?? "",
      contact: d.donataria.phone ?? "",
      email: d.donataria.email ?? "",
      equipment: equipmentText,
      totalItems: d.items.reduce((sum, i) => sum + i.quantity, 0),
      kitsCount: d.kitsCount,
    };
  });

  if (q) {
    rows = rows.filter((r) => {
      const hay =
        `${r.municipality} ${r.entity} ${r.address} ${r.responsible} ${r.contact} ${r.email} ${r.belongsTo ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  const totalQuantity = rows.reduce((sum, r) => sum + r.quantity, 0);

  return jsonOk({
    rows,
    totals: {
      terms: rows.length,
      quantity: totalQuantity,
    },
    belongsToOptions: ["Todos", ...belongsToOptions],
  });
}
