"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate, motion } from "framer-motion";
import { toast } from "sonner";
import {
  CHARGES_FIXES_MENSUELLES,
  CHARGE_RECRUE_MENSUELLE,
} from "@/lib/finance-kpi";
import {
  Loader2,
  Orbit,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";
import { applyStrategyToKanban } from "@/app/actions/simulator-actions";

function useAnimatedNumber(target: number) {
  const [display, setDisplay] = useState(target);
  const ref = useRef(target);

  useEffect(() => {
    const from = ref.current;
    const controls = animate(from, target, {
      duration: 0.48,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        ref.current = v;
        setDisplay(v);
      },
      onComplete: () => {
        ref.current = target;
      },
    });
    return () => controls.stop();
  }, [target]);

  return display;
}

function formatPrix(prix: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(prix);
}

function formatPrixFull(prix: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(prix);
}

type Props = {
  varPrix: number;
  varTrafic: number;
  recrue: boolean;
  onVarPrixChange: (v: number) => void;
  onVarTraficChange: (v: number) => void;
  onRecrueChange: (v: boolean) => void;
  onReset: () => void;
  caProjeteFinMois: number;
  soldeBancaire: number;
};

function SimSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  suffix,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-white/75">{label}</span>
        <span className="tabular-nums text-fuchsia-200/95">
          {value > 0 ? "+" : ""}
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-fuchsia-400 [&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white/40 [&::-moz-range-thumb]:bg-gradient-to-br [&::-moz-range-thumb]:from-fuchsia-400 [&::-moz-range-thumb]:to-cyan-400 [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/40 [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-fuchsia-400 [&::-webkit-slider-thumb]:to-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(232,121,249,0.45)]"
      />
    </div>
  );
}

export default function BusinessSimulator({
  varPrix,
  varTrafic,
  recrue,
  onVarPrixChange,
  onVarTraficChange,
  onRecrueChange,
  onReset,
  caProjeteFinMois,
  soldeBancaire,
}: Props) {
  const [applying, setApplying] = useState(false);

  const mult = useMemo(
    () => (1 + varPrix / 100) * (1 + varTrafic / 100),
    [varPrix, varTrafic]
  );

  const nouveauCA = caProjeteFinMois * mult;
  const chargesRunwayDenom =
    CHARGES_FIXES_MENSUELLES + (recrue ? CHARGE_RECRUE_MENSUELLE : 0);
  const runway = chargesRunwayDenom > 0 ? soldeBancaire / chargesRunwayDenom : 0;
  const budgetReassort =
    soldeBancaire - nouveauCA * 0.2 - CHARGES_FIXES_MENSUELLES;

  const animCA = useAnimatedNumber(nouveauCA);
  const animRunway = useAnimatedNumber(runway);
  const animBudget = useAnimatedNumber(budgetReassort);

  const isRisky = !Number.isFinite(runway) || runway < 2;
  const isExcellent = Number.isFinite(runway) && runway >= 6 && budgetReassort > 3000;

  const hasStrategyChanges =
    varPrix !== 0 || varTrafic !== 0 || recrue === true;

  const handleApply = async () => {
    if (!hasStrategyChanges || applying) return;
    setApplying(true);
    try {
      const result = await applyStrategyToKanban(varPrix, varTrafic, recrue);
      if (!result.ok) {
        if (result.error === "no_changes") {
          toast.error("Ajustez au moins un curseur ou activez la recrue.", {
            duration: 4000,
          });
        } else if (result.error === "unauthorized" || result.error === "forbidden") {
          toast.error("Session expirée ou droits insuffisants.", {
            duration: 4000,
          });
        } else {
          toast.error("Enregistrement impossible", {
            description: result.error,
            duration: 5000,
          });
        }
        return;
      }
      toast.success(
        "✅ Stratégie appliquée ! Les missions ont été envoyées dans le Kanban de l'équipe.",
        {
          duration: 5500,
          className:
            "!rounded-2xl !border !border-emerald-400/50 !bg-emerald-950/95 !text-emerald-50 !shadow-xl",
        }
      );
      onReset();
    } finally {
      setApplying(false);
    }
  };

  return (
    <motion.div
      className="relative overflow-hidden rounded-[1.5rem] border border-white/15 bg-gradient-to-br from-[#0c0c12] via-[#12121c] to-[#0a0a10] p-6 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:p-8"
      animate={
        isRisky
          ? {
              boxShadow: [
                "0 32px 80px -24px rgba(0,0,0,0.55), 0 0 0 0 rgba(239,68,68,0)",
                "0 32px 80px -24px rgba(0,0,0,0.55), 0 0 0 1px rgba(239,68,68,0.25)",
                "0 32px 80px -24px rgba(0,0,0,0.55), 0 0 0 0 rgba(239,68,68,0)",
              ],
            }
          : { boxShadow: "0 32px 80px -24px rgba(0,0,0,0.55)" }
      }
      transition={
        isRisky
          ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.3 }
      }
    >
      {/* Iris border glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[1.5rem] opacity-90"
        style={{
          background:
            "linear-gradient(135deg, rgba(168,85,247,0.15) 0%, transparent 40%, transparent 60%, rgba(34,211,238,0.12) 100%)",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          padding: "1px",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-fuchsia-600/20 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-500/15 blur-[90px]"
        aria-hidden
      />

      {/* Excellent: subtle green light + particles */}
      {isExcellent && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.5rem]">
          <motion.div
            className="absolute -right-8 bottom-0 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl"
            animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.08, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          {[...Array(12)].map((_, i) => (
            <motion.span
              key={i}
              className="absolute h-1 w-1 rounded-full bg-emerald-400/70 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
              style={{
                left: `${8 + (i * 7) % 84}%`,
                top: `${12 + (i * 11) % 76}%`,
              }}
              animate={{ opacity: [0.2, 0.9, 0.2], y: [0, -6, 0] }}
              transition={{
                duration: 2.5 + (i % 4) * 0.3,
                repeat: Infinity,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-cyan-500/20 ring-1 ring-white/20">
              <Orbit className="h-6 w-6 text-fuchsia-200" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fuchsia-300/80">
                Projection
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white md:text-2xl">
                Simulateur d&apos;avenir
              </h2>
              <p className="mt-1 max-w-xl text-sm text-white/55">
                Ajustez prix, fréquentation et effectif — les indicateurs se
                recalculent en direct à partir de vos données réelles.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/90 backdrop-blur-sm transition hover:bg-white/10"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Réinitialiser
            </button>
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={!hasStrategyChanges || applying}
              title={
                !hasStrategyChanges
                  ? "Modifiez un curseur ou la recrue pour créer des missions"
                  : undefined
              }
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-fuchsia-900/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {applying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              {applying ? "Application…" : "Appliquer cette stratégie"}
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Controls */}
          <div className="space-y-6 lg:col-span-5">
            <SimSlider
              label="Prix de vente"
              min={-10}
              max={25}
              step={1}
              value={varPrix}
              onChange={onVarPrixChange}
              suffix="%"
            />
            <SimSlider
              label="Fréquentation boutique"
              min={-30}
              max={50}
              step={1}
              value={varTrafic}
              onChange={onVarTraficChange}
              suffix="%"
            />
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
              <div>
                <p className="text-sm font-medium text-white/90">
                  Nouvelle recrue
                </p>
                <p className="text-[11px] text-white/45">
                  +{CHARGE_RECRUE_MENSUELLE.toLocaleString("fr-FR")} € / mois de
                  charge fixe
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={recrue}
                onClick={() => onRecrueChange(!recrue)}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                  recrue ? "bg-fuchsia-500" : "bg-white/15"
                }`}
              >
                <motion.span
                  className="absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-md"
                  layout
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                  animate={{ x: recrue ? 24 : 0 }}
                />
              </button>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-7">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-200/70">
                CA simulé (fin de mois)
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-white md:text-3xl">
                {formatPrixFull(animCA)}
              </p>
              <p className="mt-2 text-[11px] text-white/40">
                ×{(mult).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}{" "}
                vs projection actuelle
              </p>
            </div>
            <div
              className={`rounded-2xl border p-4 backdrop-blur-md ${
                isRisky
                  ? "border-red-500/35 bg-red-500/10"
                  : "border-white/10 bg-white/[0.04]"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/70">
                Runway (trésorerie)
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-white md:text-3xl">
                {animRunway.toLocaleString("fr-FR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{" "}
                <span className="text-lg font-medium text-white/50">mois</span>
              </p>
              <p className="mt-2 text-[11px] leading-snug text-white/45">
                Solde ÷ charges fixes
                {recrue ? " (recrue incluse)" : ""}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/15 to-orange-600/10 p-4 backdrop-blur-md ring-1 ring-amber-400/20">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-100/90">
                <Sparkles className="h-3 w-3" />
                Budget réassort
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-amber-50 md:text-3xl">
                {formatPrix(animBudget)}
              </p>
              <p className="mt-2 text-[11px] text-amber-100/55">
                Après TVA 20 % sur CA simulé et charges fixes
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
