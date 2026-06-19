export type ReceiptLine = {
  label: string;
  subtitle?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type ClientReceipt = {
  venteId: string;
  ticketNumber: string;
  createdAt: string;
  shopName: string;
  shopAddress?: string;
  vendeuseName?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  /** Taux TVA affiché (TTC) — défaut 20 % */
  tvaRate: number;
  tvaAmount: number;
};

export const DEFAULT_SHOP_NAME = "Latifa Shop";
export const DEFAULT_TVA_RATE = 0.2;
