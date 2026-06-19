import { jsPDF } from "jspdf";

import type { ClientReceipt } from "@/lib/ticket/receipt-types";
import { formatMoneyFr, formatReceiptDate } from "@/lib/ticket/format";

const MARGIN = 12;
const PAGE_WIDTH = 80;
const LINE_HEIGHT = 4.2;
const MAX_WIDTH = PAGE_WIDTH - MARGIN * 2;

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

/** Génère un PDF ticket de caisse (format thermique ~80 mm). */
export function generateReceiptPdf(receipt: ClientReceipt): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [PAGE_WIDTH, 200],
  });

  let y = MARGIN;

  const addCenter = (text: string, size = 10, style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.text(text, PAGE_WIDTH / 2, y, { align: "center" });
    y += LINE_HEIGHT + (size > 10 ? 1 : 0);
  };

  const addLeft = (text: string, size = 9, style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = wrapText(doc, text, MAX_WIDTH);
    doc.text(lines, MARGIN, y);
    y += lines.length * LINE_HEIGHT;
  };

  const addRow = (left: string, right: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.text(left, MARGIN, y);
    doc.text(right, PAGE_WIDTH - MARGIN, y, { align: "right" });
    y += LINE_HEIGHT;
  };

  addCenter(receipt.shopName, 12, "bold");
  if (receipt.shopAddress) {
    addCenter(receipt.shopAddress, 8);
  }
  y += 1;
  addCenter("TICKET DE CAISSE", 9, "bold");
  addCenter(`N° ${receipt.ticketNumber}`, 8);
  addCenter(formatReceiptDate(receipt.createdAt), 8);
  y += 2;

  doc.setDrawColor(180);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 3;

  for (const line of receipt.lines) {
    addLeft(`${line.quantity} × ${line.label}`, 9, "bold");
    if (line.subtitle) addLeft(line.subtitle, 7);
    addRow(
      `@ ${formatMoneyFr(line.unitPrice)}`,
      formatMoneyFr(line.lineTotal)
    );
    y += 0.5;
  }

  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 3;

  addRow("Sous-total", formatMoneyFr(receipt.subtotal));
  if (receipt.discount > 0) {
    addRow("Remise", `-${formatMoneyFr(receipt.discount)}`);
  }
  addRow("TOTAL TTC", formatMoneyFr(receipt.total), true);
  y += 1;
  addRow(
    `TVA incl. (${Math.round(receipt.tvaRate * 100)} %)`,
    formatMoneyFr(receipt.tvaAmount)
  );
  addRow("Paiement", receipt.paymentMethod);
  y += 2;

  if (receipt.clientName) {
    addLeft(`Client : ${receipt.clientName}`, 8);
  }
  if (receipt.vendeuseName) {
    addLeft(`Vendeuse : ${receipt.vendeuseName}`, 8);
  }

  y += 2;
  addCenter("Merci de votre visite !", 9, "bold");
  addCenter(`${receipt.shopName}`, 7);

  return doc;
}

export function generateReceiptPdfBlob(receipt: ClientReceipt): Blob {
  const doc = generateReceiptPdf(receipt);
  return doc.output("blob");
}

export function downloadReceiptPdf(receipt: ClientReceipt, filename?: string): void {
  const doc = generateReceiptPdf(receipt);
  doc.save(filename ?? `ticket-${receipt.ticketNumber}.pdf`);
}

export function receiptPdfToBase64(receipt: ClientReceipt): string {
  const doc = generateReceiptPdf(receipt);
  const dataUri = doc.output("datauristring");
  const base64 = dataUri.split(",")[1];
  return base64 ?? "";
}
