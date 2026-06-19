"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Mail, X } from "lucide-react";
import { toast } from "sonner";

import type { ClientReceipt } from "@/lib/ticket/receipt-types";
import { formatMoneyFr, formatReceiptDate, isValidEmail } from "@/lib/ticket/format";
import { downloadReceiptPdf } from "@/lib/ticket/generate-pdf";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Ticket déjà construit (post-vente immédiate) */
  receipt?: ClientReceipt | null;
  /** Ou chargement depuis l'API par id vente (historique) */
  venteId?: string | null;
  defaultEmail?: string;
};

export default function TicketClientModal({
  open,
  onClose,
  receipt: receiptProp,
  venteId,
  defaultEmail = "",
}: Props) {
  const [receipt, setReceipt] = useState<ClientReceipt | null>(receiptProp ?? null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [sending, setSending] = useState(false);
  const [saveToClient, setSaveToClient] = useState(true);

  useEffect(() => {
    if (receiptProp) setReceipt(receiptProp);
  }, [receiptProp]);

  useEffect(() => {
    setEmail(defaultEmail);
  }, [defaultEmail, open]);

  const loadFromApi = useCallback(async () => {
    if (!venteId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ticket/${venteId}`);
      const payload = (await res.json()) as {
        receipt?: ClientReceipt;
        error?: string;
      };
      if (!res.ok || !payload.receipt) {
        toast.error(payload.error ?? "Ticket introuvable.");
        setReceipt(null);
        return;
      }
      setReceipt(payload.receipt);
      if (payload.receipt.clientEmail && !defaultEmail) {
        setEmail(payload.receipt.clientEmail);
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }, [venteId, defaultEmail]);

  useEffect(() => {
    if (!open) return;
    if (receiptProp) {
      setReceipt(receiptProp);
      return;
    }
    if (venteId) void loadFromApi();
  }, [open, receiptProp, venteId, loadFromApi]);

  const handleDownload = () => {
    if (!receipt) return;
    downloadReceiptPdf(receipt);
    toast.success("PDF téléchargé.");
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receipt) return;
    if (!isValidEmail(email)) {
      toast.error("Adresse e-mail invalide.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/ticket/${receipt.venteId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, saveToClient }),
      });
      const payload = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        toast.error(payload.error ?? "Envoi impossible.");
        return;
      }
      toast.success(payload.message ?? "Ticket envoyé.");
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[230] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-client-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id="ticket-client-title" className="text-lg font-semibold text-gray-900">
              Ticket client
            </h2>
            <p className="text-xs text-gray-500">PDF ou e-mail post-vente</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Chargement du ticket…
            </div>
          ) : !receipt ? (
            <p className="py-8 text-center text-sm text-gray-500">
              Ticket indisponible.
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-4 font-mono text-[11px] leading-relaxed text-gray-800">
                <p className="text-center text-sm font-bold text-gray-900">
                  {receipt.shopName}
                </p>
                {receipt.shopAddress && (
                  <p className="text-center text-gray-500">{receipt.shopAddress}</p>
                )}
                <p className="mt-2 text-center font-semibold">TICKET N° {receipt.ticketNumber}</p>
                <p className="text-center text-gray-500">
                  {formatReceiptDate(receipt.createdAt)}
                </p>
                <div className="my-3 border-t border-dashed border-gray-300" />
                {receipt.lines.map((line, i) => (
                  <div key={`${line.label}-${i}`} className="mb-2">
                    <div className="flex justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate">
                        {line.quantity}× {line.label}
                      </span>
                      <span className="shrink-0">{formatMoneyFr(line.lineTotal)}</span>
                    </div>
                    {line.subtitle && (
                      <p className="text-gray-500">{line.subtitle}</p>
                    )}
                  </div>
                ))}
                <div className="my-3 border-t border-dashed border-gray-300" />
                {receipt.discount > 0 && (
                  <div className="flex justify-between">
                    <span>Remise</span>
                    <span>-{formatMoneyFr(receipt.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold">
                  <span>TOTAL TTC</span>
                  <span>{formatMoneyFr(receipt.total)}</span>
                </div>
                <div className="mt-1 flex justify-between text-gray-500">
                  <span>TVA incl.</span>
                  <span>{formatMoneyFr(receipt.tvaAmount)}</span>
                </div>
                <p className="mt-2 text-gray-500">Paiement : {receipt.paymentMethod}</p>
              </div>

              <button
                type="button"
                onClick={handleDownload}
                className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Télécharger le PDF
              </button>

              <form onSubmit={(e) => void handleSendEmail(e)} className="mt-4 space-y-3">
                <label className="block text-sm font-medium text-gray-700" htmlFor="ticket-email">
                  Envoyer par e-mail
                </label>
                <input
                  id="ticket-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@exemple.com"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={saveToClient}
                    onChange={(e) => setSaveToClient(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Enregistrer l&apos;e-mail sur la fiche client
                </label>
                <button
                  type="submit"
                  disabled={sending || !email.trim()}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Envoi…
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Envoyer le ticket
                    </>
                  )}
                </button>
                <p className="text-[11px] leading-relaxed text-gray-500">
                  L&apos;envoi e-mail nécessite{" "}
                  <code className="rounded bg-gray-100 px-1">RESEND_API_KEY</code> et{" "}
                  <code className="rounded bg-gray-100 px-1">TICKET_FROM_EMAIL</code>{" "}
                  côté serveur. Le PDF fonctionne sans configuration.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
