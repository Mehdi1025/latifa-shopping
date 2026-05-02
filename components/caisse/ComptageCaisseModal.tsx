"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

/** Coupures (spec POS) — billets et pièces */
export const COUPURES_BILLETS = [100, 50, 20, 10, 5] as const;
export const COUPURES_PIECES = [2, 1, 0.5, 0.2, 0.1] as const;

function formatCoupureLabel(euros: number): string {
  if (euros >= 1) return `${euros} €`;
  return `${euros.toFixed(2).replace(".", ",")} €`;
}

function formatMoneyFr(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export type DenomKey = string;

function buildInitialQuantities(): Record<DenomKey, string> {
  const o: Record<DenomKey, string> = {};
  for (const d of COUPURES_BILLETS) o[String(d)] = "";
  for (const d of COUPURES_PIECES) o[String(d)] = "";
  return o;
}

function parseQty(raw: string): number {
  const s = raw.trim().replace(/\s/g, "");
  if (s === "") return 0;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function buildDetailsComptage(
  quantities: Record<DenomKey, string>
): Record<string, number> {
  const o: Record<string, number> = {};
  for (const d of COUPURES_BILLETS) {
    const n = parseQty(quantities[String(d)] ?? "");
    if (n > 0) o[String(d)] = n;
  }
  for (const d of COUPURES_PIECES) {
    const n = parseQty(quantities[String(d)] ?? "");
    if (n > 0) o[String(d)] = n;
  }
  return o;
}

/** Total euros à partir des quantités saisies */
export function totalFromQuantities(
  quantities: Record<DenomKey, string>
): number {
  let s = 0;
  for (const d of COUPURES_BILLETS) {
    s += d * parseQty(quantities[String(d)] ?? "");
  }
  for (const d of COUPURES_PIECES) {
    s += d * parseQty(quantities[String(d)] ?? "");
  }
  return Math.round(s * 100) / 100;
}

export type ClotureCaissePayload = {
  totalDeclareEtape1: number;
  detailsComptageTotalTiroir: Record<string, number>;
  fondLaisseEtape2: number;
  detailsComptageFondLaisse: Record<string, number>;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (payload: ClotureCaissePayload) => void | Promise<void>;
  loading: boolean;
  fondInitial: number;
  montantAttenduCaisse: number | null;
  montantAttenduLoading: boolean;
};

function DenominationGrid(props: {
  titleBillets: string;
  titlePieces: string;
  quantities: Record<DenomKey, string>;
  onChangeQty: (key: string, value: string) => void;
}) {
  const { titleBillets, titlePieces, quantities, onChangeQty } = props;
  return (
    <>
      <p className="mb-2 text-sm font-medium text-gray-800">{titleBillets}</p>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:max-w-2xl">
        {COUPURES_BILLETS.map((d) => (
          <label
            key={d}
            className="flex flex-col rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2.5"
          >
            <span className="text-xs font-medium text-gray-600">
              {formatCoupureLabel(d)}
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="done"
              value={quantities[String(d)]}
              onChange={(e) => onChangeQty(String(d), e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-base text-gray-900 touch-manipulation [-webkit-appearance:none]"
              placeholder="0"
            />
          </label>
        ))}
      </div>

      <p className="mb-2 text-sm font-medium text-gray-800">{titlePieces}</p>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:max-w-2xl">
        {COUPURES_PIECES.map((d) => (
          <label
            key={d}
            className="flex flex-col rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2.5"
          >
            <span className="text-xs font-medium text-gray-600">
              {formatCoupureLabel(d)}
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="done"
              value={quantities[String(d)]}
              onChange={(e) => onChangeQty(String(d), e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-base text-gray-900 touch-manipulation [-webkit-appearance:none]"
              placeholder="0"
            />
          </label>
        ))}
      </div>
    </>
  );
}

const footerBtnNeutral =
  "inline-flex w-full min-h-[3rem] shrink-0 touch-manipulation select-none items-center justify-center whitespace-nowrap rounded-xl border px-4 py-3 text-center text-sm font-medium [-webkit-tap-highlight-color:transparent] transition-[transform,colors] duration-150 active:scale-[0.99] [@media(min-width:640px)]:w-auto";
const footerBtnGhost = `${footerBtnNeutral} border-gray-300 text-gray-800 hover:bg-gray-50 disabled:opacity-50`;
const footerBtnOutline = `${footerBtnNeutral} border-gray-200 text-gray-700 hover:bg-gray-50`;
const footerBtnPrimary =
  "inline-flex w-full min-h-[min(3.75rem,max(3rem,11vw))] shrink-0 touch-manipulation select-none items-center justify-center text-balance rounded-xl bg-gray-900 px-4 py-[0.65rem] text-center text-[0.9375rem] font-semibold leading-snug text-white [-webkit-tap-highlight-color:transparent] transition-[transform,colors] duration-150 hover:bg-gray-800 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 [@media(min-width:640px)]:w-auto [@media(min-width:640px)]:min-h-[3rem] [@media(min-width:640px)]:max-w-xl [@media(min-width:640px)]:flex-[1_1_auto] [@media(min-width:640px)]:px-5 [@media(min-width:640px)]:py-3 [@media(min-width:640px)]:text-sm";

export default function ComptageCaisseModal({
  open,
  onOpenChange,
  onSubmit,
  loading,
  fondInitial,
  montantAttenduCaisse,
  montantAttenduLoading,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [quantitiesEtape1, setQuantitiesEtape1] = useState<
    Record<DenomKey, string>
  >(() => buildInitialQuantities());
  const [quantitiesEtape2, setQuantitiesEtape2] = useState<
    Record<DenomKey, string>
  >(() => buildInitialQuantities());

  const totalDeclareEtape1 = useMemo(
    () => totalFromQuantities(quantitiesEtape1),
    [quantitiesEtape1]
  );

  const fondLaisseCalcule = useMemo(
    () => totalFromQuantities(quantitiesEtape2),
    [quantitiesEtape2]
  );

  const ecartEtape1 = useMemo(() => {
    if (montantAttenduCaisse == null || !Number.isFinite(montantAttenduCaisse))
      return null;
    return (
      Math.round((totalDeclareEtape1 - montantAttenduCaisse) * 100) / 100
    );
  }, [totalDeclareEtape1, montantAttenduCaisse]);

  const montantEnveloppe = useMemo(() => {
    return (
      Math.round((totalDeclareEtape1 - fondLaisseCalcule) * 100) / 100
    );
  }, [totalDeclareEtape1, fondLaisseCalcule]);

  const fondExcedeTotal =
    fondLaisseCalcule > totalDeclareEtape1 + 1e-6;

  const resetAll = useCallback(() => {
    setStep(1);
    setQuantitiesEtape1(buildInitialQuantities());
    setQuantitiesEtape2(buildInitialQuantities());
  }, []);

  useEffect(() => {
    if (open) resetAll();
  }, [open, resetAll]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    resetAll();
  }, [onOpenChange, resetAll]);

  const setQtyEtape1 = (key: string, value: string) => {
    if (value === "" || /^\d+$/.test(value)) {
      setQuantitiesEtape1((prev) => ({ ...prev, [key]: value }));
    }
  };

  const setQtyEtape2 = (key: string, value: string) => {
    if (value === "" || /^\d+$/.test(value)) {
      setQuantitiesEtape2((prev) => ({ ...prev, [key]: value }));
    }
  };

  const gotoStep2 = () => {
    setQuantitiesEtape2(buildInitialQuantities());
    setStep(2);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-skip-ean-capture
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[220] flex h-[100dvh] max-h-[100dvh] touch-pan-y flex-col overflow-hidden bg-white"
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-6">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Étape {step} sur 2
              </p>
              <h2 className="text-xl font-bold tracking-tight text-gray-900">
                Clôture de Caisse
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {step === 1 ? (
                  <>
                    Comptage du contenu du tiroir avant prélèvement. Le total et
                    l’écart se mettent à jour automatiquement.
                  </>
                ) : (
                  <>
                    Indiquez ce que vous{" "}
                    <span className="font-semibold text-gray-800">
                      laissez dans le tiroir
                    </span>{" "}
                    comme fond pour demain (le surplus part dans l’enveloppe).
                  </>
                )}
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Fond initial de la session :{" "}
                <span className="font-semibold text-gray-900">
                  {formatMoneyFr(fondInitial)}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              aria-label="Fermer"
            >
              <X className="h-6 w-6" />
            </button>
          </header>

          <div
            className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 [scroll-padding-block-end:max(1rem,env(safe-area-inset-bottom))] [scroll-padding-block-start:0.5rem] md:px-6 md:pb-6"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {step === 1 ? (
              <DenominationGrid
                titleBillets="Billets dans le tiroir"
                titlePieces="Pièces dans le tiroir"
                quantities={quantitiesEtape1}
                onChangeQty={setQtyEtape1}
              />
            ) : (
              <>
                <p className="mb-4 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-3 text-sm text-amber-950">
                  Saisissez les billets et pièces que vous{" "}
                  <strong>Laissez</strong> dans le tiroir pour demain (fond de
                  caisse).
                </p>
                <DenominationGrid
                  titleBillets="Billets laissés"
                  titlePieces="Pièces laissées"
                  quantities={quantitiesEtape2}
                  onChangeQty={setQtyEtape2}
                />
              </>
            )}
          </div>

          <footer className="isolate shrink-0 border-t border-gray-100 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_24px_-12px_rgba(0,0,0,0.08)] px-4 md:px-6">
            {step === 1 && (
              <>
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
                      Total déclaré (tiroir)
                    </p>
                    <p className="text-2xl font-bold tabular-nums text-emerald-950">
                      {formatMoneyFr(totalDeclareEtape1)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
                      Montant attendu (fond + ventes esp.)
                    </p>
                    <p className="text-xl font-semibold tabular-nums text-slate-900">
                      {montantAttenduLoading ? (
                        <span className="text-slate-400">Calcul…</span>
                      ) : montantAttenduCaisse != null ? (
                        formatMoneyFr(montantAttenduCaisse)
                      ) : (
                        <span className="text-sm font-normal text-amber-700">
                          Impossible à calculer
                        </span>
                      )}
                    </p>
                    {ecartEtape1 != null && (
                      <p
                        className={`mt-1 text-sm font-medium tabular-nums ${
                          ecartEtape1 === 0
                            ? "text-emerald-800"
                            : "text-orange-700"
                        }`}
                      >
                        Écart : {formatMoneyFr(ecartEtape1)}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-blue-900">
                      Fond laissé (demain)
                    </p>
                    <p className="text-2xl font-bold tabular-nums text-blue-950">
                      {formatMoneyFr(fondLaisseCalcule)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 px-4 py-4 shadow-sm">
                    <p className="text-sm font-semibold text-violet-950">
                      💰 Montant à mettre dans l’enveloppe (prélèvement)
                    </p>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-violet-950">
                      {formatMoneyFr(
                        montantEnveloppe < 0 ? 0 : montantEnveloppe
                      )}
                    </p>
                  </div>
                </div>
                {fondExcedeTotal && (
                  <p className="mb-3 text-center text-sm font-medium text-red-600">
                    Le fond laissé ne peut pas dépasser le total compté à l’étape
                    1 ({formatMoneyFr(totalDeclareEtape1)}).
                  </p>
                )}
              </>
            )}

            {step === 1 ? (
              <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-stretch sm:justify-end sm:gap-x-3 sm:gap-y-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className={`${footerBtnOutline} shrink-0 sm:order-1 sm:min-w-[8.5rem]`}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={gotoStep2}
                  className={`${footerBtnPrimary} text-pretty sm:order-2`}
                >
                  Suivant&nbsp;: préparer la caisse de demain
                </button>
              </div>
            ) : (
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-stretch sm:justify-end sm:gap-x-3 sm:gap-y-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className={`${footerBtnOutline} min-w-0 sm:order-1 sm:min-w-[8.25rem]`}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setStep(1)}
                  className={`${footerBtnGhost} min-w-0 sm:order-2 sm:min-w-[7.75rem]`}
                >
                  Retour
                </button>
                <button
                  type="button"
                  disabled={loading || fondExcedeTotal}
                  onClick={() =>
                    onSubmit({
                      totalDeclareEtape1,
                      detailsComptageTotalTiroir: buildDetailsComptage(
                        quantitiesEtape1
                      ),
                      fondLaisseEtape2: fondLaisseCalcule,
                      detailsComptageFondLaisse: buildDetailsComptage(
                        quantitiesEtape2
                      ),
                    })
                  }
                  className={`${footerBtnPrimary} col-span-2 sm:order-3 sm:max-w-md`}
                >
                  {loading ? "Validation…" : "🔒 Valider et clôturer"}
                </button>
              </div>
            )}
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
