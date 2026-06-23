import type { ClientReceipt } from "@/lib/ticket/receipt-types";
import { formatMoneyFr, formatReceiptDate, getShopName } from "@/lib/ticket/format";
import { receiptPdfToBase64 } from "@/lib/ticket/generate-pdf";

/** Expéditeur Resend de test (uniquement vers l'e-mail du compte Resend). */
const RESEND_TEST_FROM = "onboarding@resend.dev";

function resolveTicketFromEmail(): string {
  const explicit =
    process.env.TICKET_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim();
  if (explicit) return explicit;

  // Secours : permet de tester sur Vercel avec seulement RESEND_API_KEY
  return `${getShopName()} <${RESEND_TEST_FROM}>`;
}

export class TicketEmailError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "TicketEmailError";
  }
}

function buildEmailHtml(receipt: ClientReceipt): string {
  const linesHtml = receipt.lines
    .map(
      (l) =>
        `<tr>
          <td style="padding:6px 0;border-bottom:1px solid #eee;">
            ${l.quantity} × ${l.label}${l.subtitle ? `<br><span style="color:#666;font-size:12px;">${l.subtitle}</span>` : ""}
          </td>
          <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">
            ${formatMoneyFr(l.lineTotal)}
          </td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<body style="font-family:Arial,sans-serif;color:#111;max-width:520px;margin:0 auto;padding:24px;">
  <h1 style="font-size:20px;margin:0 0 8px;">${receipt.shopName}</h1>
  <p style="color:#666;margin:0 0 16px;">Votre ticket de caisse — ${formatReceiptDate(receipt.createdAt)}</p>
  <p style="margin:0 0 16px;">Bonjour${receipt.clientName ? ` ${receipt.clientName}` : ""},<br>
  Merci pour votre achat chez ${receipt.shopName}. Votre ticket n° <strong>${receipt.ticketNumber}</strong> est joint en PDF.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    ${linesHtml}
  </table>
  <p style="text-align:right;font-size:18px;font-weight:bold;margin:16px 0;">
    Total TTC : ${formatMoneyFr(receipt.total)}
  </p>
  <p style="color:#666;font-size:13px;">Paiement : ${receipt.paymentMethod}</p>
  <p style="margin-top:24px;color:#666;font-size:13px;">À bientôt,<br>${receipt.shopName}</p>
</body>
</html>`;
}

/** Envoie le ticket par e-mail via l'API Resend. */
export async function sendTicketEmail(
  receipt: ClientReceipt,
  toEmail: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = resolveTicketFromEmail();

  if (!apiKey) {
    throw new TicketEmailError(
      "RESEND_API_KEY non configurée — ajoutez-la dans Vercel (Settings → Environment Variables) puis redéployez.",
      503
    );
  }

  const pdfBase64 = receiptPdfToBase64(receipt);
  const subject = `Votre ticket ${receipt.shopName} — n° ${receipt.ticketNumber}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [toEmail.trim()],
      subject,
      html: buildEmailHtml(receipt),
      attachments: [
        {
          filename: `ticket-${receipt.ticketNumber}.pdf`,
          content: pdfBase64,
        },
      ],
    }),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch {
      /* ignore */
    }
    throw new TicketEmailError(`Envoi e-mail échoué : ${detail}`, 502);
  }
}
