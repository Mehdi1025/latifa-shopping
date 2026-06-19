import {
  ClientReceipt,
  DEFAULT_SHOP_NAME,
  DEFAULT_TVA_RATE,
  type ReceiptLine,
} from "@/lib/ticket/receipt-types";

export function formatMoneyFr(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatReceiptDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shortTicketNumber(venteId: string): string {
  return venteId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function computeTvaFromTtc(totalTtc: number, rate = DEFAULT_TVA_RATE): number {
  if (totalTtc <= 0 || rate <= 0) return 0;
  return Math.round((totalTtc - totalTtc / (1 + rate)) * 100) / 100;
}

export function libelleMoyenPaiement(
  methode: string | null | undefined
): string {
  switch ((methode ?? "").trim().toLowerCase()) {
    case "carte":
      return "Carte bancaire";
    case "especes":
      return "Espèces";
    case "paypal":
      return "PayPal";
    case "mixte":
      return "Mixte (espèces + carte)";
    default:
      return methode?.trim() || "Non renseigné";
  }
}

export function formatVariantSubtitle(produit: {
  taille?: string | null;
  couleur?: string | null;
}): string | null {
  const parts = [produit.taille, produit.couleur]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function getShopName(): string {
  return process.env.NEXT_PUBLIC_SHOP_NAME?.trim() || DEFAULT_SHOP_NAME;
}

export function getShopAddress(): string | undefined {
  const addr = process.env.NEXT_PUBLIC_SHOP_ADDRESS?.trim();
  return addr || undefined;
}

type BuildReceiptInput = {
  venteId: string;
  createdAt: string;
  total: number;
  remise?: number | null;
  methodePaiement?: string | null;
  vendeuseName?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  lines: ReceiptLine[];
};

/** Construit un ticket client à partir des données de vente. */
export function buildClientReceipt(input: BuildReceiptInput): ClientReceipt {
  const subtotal = input.lines.reduce((s, l) => s + l.lineTotal, 0);
  const discount = Math.max(0, input.remise ?? Math.max(0, subtotal - input.total));
  const total = input.total;
  const tvaRate = DEFAULT_TVA_RATE;

  return {
    venteId: input.venteId,
    ticketNumber: shortTicketNumber(input.venteId),
    createdAt: input.createdAt,
    shopName: getShopName(),
    shopAddress: getShopAddress(),
    vendeuseName: input.vendeuseName?.trim() || undefined,
    clientName: input.clientName?.trim() || undefined,
    clientEmail: input.clientEmail?.trim() || undefined,
    clientPhone: input.clientPhone?.trim() || undefined,
    lines: input.lines,
    subtotal,
    discount,
    total,
    paymentMethod: libelleMoyenPaiement(input.methodePaiement),
    tvaRate,
    tvaAmount: computeTvaFromTtc(total, tvaRate),
  };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
