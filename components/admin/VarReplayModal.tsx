"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Loader2,
  Pause,
  Play,
  RotateCcw,
  ShoppingBag,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

const STEP_MS = 1500;
const WINDOW_BEFORE_MS = 5 * 60 * 1000;
const WINDOW_AFTER_MS = 2 * 60 * 1000;

export type VarLogRow = {
  id: string;
  created_at: string;
  vendeur_nom: string | null;
  type_action: string;
  details: string | null;
  niveau_alerte: string;
};

export type VarReplayModalProps = {
  open: boolean;
  onClose: () => void;
  targetTimeISO: string;
  targetVendeuse: string;
};

function normType(t: string): string {
  return t.trim().toLowerCase();
}

function isScanLike(type: string): boolean {
  const n = normType(type);
  return n === "scan" || n === "scan_ean" || n.startsWith("scan_") || n.includes("scan");
}

function cartLabelFromLog(log: VarLogRow): string {
  const d = log.details?.trim();
  if (d && d.length > 0) {
    const oneLine = d.replace(/\s+/g, " ");
    return oneLine.length > 72 ? `${oneLine.slice(0, 69)}…` : oneLine;
  }
  return "Article ajouté";
}

/** Extrait le nom d’article des libellés de suppression métier FR. */
function extractRemovalTarget(details: string | null): string | null {
  if (!details) return null;
  let m = details.match(/[Aa]\s+supprimé\s+(.+?)\s+du panier/i);
  if (!m)
    m = details.match(/[Aa]\s+retiré\s+1\s*[×x]\s*(.+?)\s+du panier/i);
  if (!m) return null;
  let raw = m[1].trim();
  raw = raw.replace(/\s*\(ligne entière.*$/i, "").trim();
  return raw || null;
}

type CartLine = { key: string; label: string };

function computeCartAfterSteps(logs: VarLogRow[], uptoInclusive: number): CartLine[] {
  const stack: CartLine[] = [];
  const slice = logs.slice(0, Math.min(uptoInclusive + 1, logs.length));
  for (const log of slice) {
    const t = normType(log.type_action);
    if (isScanLike(log.type_action)) {
      stack.push({ key: `line-${log.id}`, label: cartLabelFromLog(log) });
      continue;
    }
    if (t === "suppression_panier") {
      const tgt = extractRemovalTarget(log.details);
      if (!tgt && stack.length) {
        stack.pop();
        continue;
      }
      if (tgt) {
        const lowered = tgt.toLowerCase();
        let idx = stack.length - 1;
        while (
          idx >= 0 &&
          !stack[idx].label.toLowerCase().includes(lowered) &&
          !lowered.includes(stack[idx].label.toLowerCase())
        ) {
          idx--;
        }
        if (idx >= 0) stack.splice(idx, 1);
      }
      continue;
    }
    if (t === "annulation_vente") {
      stack.length = 0;
      continue;
    }
    if (t === "encaissement") {
      stack.length = 0;
    }
  }
  return stack;
}

function formatHeureCourt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 19);
  }
}

export default function VarReplayModal({
  open,
  onClose,
  targetTimeISO,
  targetVendeuse,
}: VarReplayModalProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [sequence, setSequence] = useState<VarLogRow[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) return;
    setFetchLoading(true);
    setFetchError(null);
    setSequence([]);
    setCurrentStep(0);
    setIsPlaying(false);

    const center = new Date(targetTimeISO);
    if (!Number.isFinite(center.getTime())) {
      setFetchError("Horodatage invalide pour le VAR.");
      setFetchLoading(false);
      return;
    }

    const from = new Date(center.getTime() - WINDOW_BEFORE_MS);
    const to = new Date(center.getTime() + WINDOW_AFTER_MS);
    const name = targetVendeuse.trim();

    void (async () => {
      let q = supabase
        .from("logs_activite")
        .select(
          "id, created_at, vendeur_nom, type_action, details, niveau_alerte"
        )
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: true });

      if (name) q = q.ilike("vendeur_nom", name);

      const { data, error } = await q;

      if (error) {
        setFetchError(error.message ?? "Chargement impossible.");
        setSequence([]);
      } else {
        setSequence((data ?? []) as VarLogRow[]);
      }
      setFetchLoading(false);
    })();
  }, [open, supabase, targetTimeISO, targetVendeuse]);

  const lastIndex = Math.max(0, sequence.length - 1);

  useEffect(() => {
    if (!isPlaying || sequence.length === 0) return;
    tickRef.current = setInterval(() => {
      setCurrentStep((s) => {
        if (s >= lastIndex) {
          setIsPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, STEP_MS);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [isPlaying, lastIndex, sequence.length]);

  const cartLines = useMemo(
    () => computeCartAfterSteps(sequence, currentStep),
    [sequence, currentStep]
  );

  const currentLog = sequence[currentStep];
  const showPaidStamp =
    currentLog && normType(currentLog.type_action) === "encaissement";
  const progress =
    sequence.length === 0
      ? 0
      : ((currentStep + 1) / sequence.length) * 100;

  const handleRestart = useCallback(() => {
    setCurrentStep(0);
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (sequence.length === 0) return;
    setIsPlaying((p) => {
      if (!p && currentStep >= lastIndex) {
        setCurrentStep(0);
        return true;
      }
      return !p;
    });
  }, [currentStep, lastIndex, sequence.length]);

  useEffect(() => {
    if (!open) return undefined;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Replay VAR séquence vendeuse"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-full w-full max-w-5xl flex-col gap-4">
        <div className="flex shrink-0 items-center justify-between gap-4 text-white">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.35em] text-indigo-200/90">
              VAR · Video replay
            </p>
            <h2 className="truncate text-lg font-semibold sm:text-xl">
              {targetVendeuse.trim() || "Sans nom vendeur"}
              <span className="ml-2 font-normal text-slate-400">
                — fenêtre −5&nbsp;min / +2&nbsp;min
              </span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/90 p-3 shadow-[0_24px_80px_-20px_rgba(0,0,0,.55)] ring-1 ring-white/10 sm:p-5">
          {fetchLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-indigo-100">
              <Loader2 className="h-11 w-11 animate-spin" />
              <p className="text-sm opacity-90">Synchronisation séquence…</p>
            </div>
          ) : fetchError ? (
            <p className="flex flex-1 items-center justify-center px-8 text-center text-sm text-red-300">
              {fetchError}
            </p>
          ) : sequence.length === 0 ? (
            <p className="flex flex-1 items-center justify-center px-8 text-center text-sm text-slate-400">
              Aucun événement pour cette fenêtre et cette vendeuse.
            </p>
          ) : (
            <>
              {/* Écran tablet 4:3 */}
              <div className="mx-auto flex min-h-0 w-full flex-1 items-center justify-center">
                <div
                  className="relative aspect-[4/3] w-full max-w-[520px] overflow-hidden rounded-[1.65rem] border border-black/35 bg-neutral-950 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.04)] ring-2 ring-neutral-900"
                  dir="ltr"
                >
                  <div className="absolute inset-[10px] flex gap-px overflow-hidden rounded-2xl border border-neutral-700/55 bg-neutral-950/90">
                    <div className="flex min-h-0 min-w-[58%] flex-1 flex-col border-r border-neutral-700/55 bg-gradient-to-br from-neutral-950 to-neutral-900 p-4">
                      <div className="mb-3 flex shrink-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                        <ShoppingBag className="h-4 w-4 text-indigo-400" aria-hidden />
                        Panier virtuel
                      </div>
                      <div className="relative min-h-0 flex-1 overflow-y-auto pr-1">
                        <AnimatePresence initial={false} mode="popLayout">
                          {cartLines.map((line) => (
                            <motion.div
                              key={line.key}
                              layout
                              initial={{ opacity: 0, y: 12, scale: 0.96 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{
                                opacity: 0,
                                scale: 0.88,
                                backgroundColor:
                                  "rgba(185,28,28,0.75)",
                                boxShadow:
                                  "0 0 0 2px rgba(248,113,113,.9)",
                                transition: {
                                  opacity: { duration: 0.42 },
                                  backgroundColor: { duration: 0.28 },
                                  scale: { duration: 0.35 },
                                },
                              }}
                              transition={{
                                type: "spring",
                                stiffness: 420,
                                damping: 28,
                              }}
                              className="mb-2 rounded-xl border border-neutral-600/55 bg-neutral-800/95 px-3 py-3 text-[13px] leading-snug text-neutral-50 shadow-sm ring-1 ring-white/[0.04]"
                            >
                              <span className="text-[11px] font-medium uppercase tracking-wide text-indigo-300/95">
                                Ligne · caisse simulée
                              </span>
                              <p className="mt-1.5">{line.label}</p>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        {cartLines.length === 0 && !showPaidStamp && (
                          <p className="text-center text-[13px] text-neutral-500">
                            Vide — évolutions au fil du replay…
                          </p>
                        )}
                      </div>
                      <AnimatePresence>
                        {showPaidStamp && (
                          <motion.div
                            key="stamp-paid"
                            initial={{ opacity: 0, scale: 0.65, rotate: -8 }}
                            animate={{
                              opacity: 1,
                              scale: [0.92, 1.05, 1],
                              rotate: [-4, 4, -2],
                            }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.45 }}
                            className="pointer-events-none absolute inset-[18%] z-30 flex items-center justify-center"
                          >
                            <div className="rounded-3xl border-[5px] border-emerald-500/95 bg-emerald-500/[0.12] px-8 py-5 shadow-[0_0_42px_-4px_rgba(16,185,129,.55)] backdrop-blur-sm">
                              <span className="text-3xl font-black tracking-[0.2em] text-emerald-300 drop-shadow-[0_2px_12px_rgba(16,185,129,.4)]">
                                PAYÉ
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="flex min-h-0 min-w-[40%] max-w-[42%] flex-1 flex-col bg-neutral-900/98 p-4">
                      <p className="mb-3 shrink-0 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
                        Flux · événement
                      </p>
                      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-neutral-700/35 bg-neutral-950/95 p-3">
                        {currentLog ? (
                          <>
                            <p className="font-mono text-[11px] text-neutral-500">
                              {formatHeureCourt(currentLog.created_at)}
                            </p>
                            <p className="mt-2 font-semibold capitalize text-neutral-100">
                              {normType(currentLog.type_action).replace(
                                /_/g,
                                " "
                              )}
                            </p>
                            <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
                              {currentLog.details ?? "—"}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-neutral-500">—</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-auto mt-4 w-full max-w-[540px] space-y-3">
                <div className="h-2 overflow-hidden rounded-full bg-neutral-800 ring-1 ring-white/10">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-emerald-500"
                    initial={false}
                    animate={{ width: `${Math.min(progress, 100)}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 22 }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={togglePlay}
                    disabled={sequence.length === 0}
                    className="inline-flex h-11 min-w-[124px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-[13px] font-semibold text-white transition hover:bg-white/[0.18] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-4 w-4" aria-hidden strokeWidth={2} />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" aria-hidden strokeWidth={2} />
                        Lecture
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-[13px] font-medium text-neutral-300 transition hover:bg-white/[0.1]"
                  >
                    <RotateCcw className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
                    Recommencer
                  </button>
                  <span className="w-full shrink-0 text-center text-[12px] text-neutral-500 sm:w-auto">
                    Étape {(currentStep + 1).toString()} / {sequence.length} ·&nbsp;
                    {STEP_MS / 1000}s / pas
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
