"use client";

import { motion } from "framer-motion";
import { Shield, Landmark, ShoppingBag } from "lucide-react";
import {
  CHARGES_FIXES_MENSUELLES,
  MOCK_SOLDE_BANCAIRE,
} from "@/lib/finance-kpi";

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

const gridVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.11, delayChildren: 0.06 },
  },
};

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
  caMois: number;
  soldeBancaire?: number;
};

/** Jauge circulaire 0–100 % (référence 12 mois de runway = plein cercle) */
function RunwayGauge({ months }: { months: number }) {
  const pct = Math.min(100, Math.max(0, (months / 12) * 100));
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div className="relative mx-auto h-[132px] w-[132px] shrink-0">
      <svg
        className="-rotate-90 transform"
        width="132"
        height="132"
        viewBox="0 0 132 132"
        aria-hidden
      >
        <defs>
          <linearGradient id="runwayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="55%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="text-sky-100/80"
        />
        <motion.circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke="url(#runwayGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - dash }}
          transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <motion.span
          className="text-2xl font-semibold tabular-nums tracking-tight text-sky-950"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.45 }}
        >
          {months.toLocaleString("fr-FR", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
        </motion.span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-sky-700/80">
          mois
        </span>
      </div>
    </div>
  );
}

export default function KpiFinanceIntel({ caMois, soldeBancaire }: Props) {
  const solde = soldeBancaire ?? MOCK_SOLDE_BANCAIRE;
  const runwayMonths = solde / CHARGES_FIXES_MENSUELLES;
  const provisionTVA = caMois * 0.2;
  const budgetSafe =
    solde - CHARGES_FIXES_MENSUELLES - provisionTVA;

  return (
    <motion.div
      className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3"
      variants={gridVariants}
      initial="hidden"
      animate="show"
    >
      {/* KPI 1 — Runway */}
      <motion.article
        variants={itemVariants}
        className="group relative overflow-hidden rounded-[1.4rem] border border-sky-200/40 bg-gradient-to-br from-sky-50/90 via-white to-emerald-50/70 p-6 shadow-[0_12px_40px_-18px_rgba(14,165,233,0.25)] backdrop-blur-xl backdrop-saturate-150 ring-1 ring-white/60 md:p-7"
      >
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-sky-300/20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col items-center text-center lg:flex-row lg:items-start lg:gap-5 lg:text-left">
          <RunwayGauge months={runwayMonths} />
          <div className="mt-5 min-w-0 flex-1 lg:mt-0">
            <div className="mb-2 flex items-center justify-center gap-2 lg:justify-start">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 ring-1 ring-sky-500/20">
                <Shield className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700/80">
                Bouclier trésorerie
              </span>
            </div>
            <h3 className="text-base font-semibold tracking-tight text-sky-950">
              Runway
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-sky-900/75">
              Votre trésorerie couvre vos charges fixes pendant{" "}
              <strong className="font-semibold text-sky-950">
                {runwayMonths.toLocaleString("fr-FR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{" "}
                mois
              </strong>{" "}
              de sécurité.
            </p>
            <p className="mt-3 text-[11px] text-sky-800/60">
              Basé sur {formatPrixFull(solde)} en banque et{" "}
              {formatPrixFull(CHARGES_FIXES_MENSUELLES)} de charges fixes / mois.
            </p>
          </div>
        </div>
      </motion.article>

      {/* KPI 2 — TVA */}
      <motion.article
        variants={itemVariants}
        className="relative overflow-hidden rounded-[1.4rem] border border-white/10 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 p-6 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.45)] ring-1 ring-white/5 md:p-7"
      >
        <div
          className="pointer-events-none absolute -left-6 top-0 h-32 w-32 rounded-full bg-orange-500/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-4 right-0 h-28 w-28 rounded-full bg-red-600/20 blur-2xl"
          aria-hidden
        />
        <div className="relative">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-orange-200 ring-1 ring-orange-400/30">
              <Landmark className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
              Provision fiscale
            </span>
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-white">
            TVA estimée
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">
            À provisionner — ne pas confondre avec du cash disponible.
          </p>
          <motion.p
            className="mt-5 text-3xl font-light tabular-nums tracking-tighter text-orange-100 md:text-[2rem]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
          >
            {formatPrixFull(provisionTVA)}
          </motion.p>
          <p className="mt-2 text-sm text-neutral-300">
            TVA collectée ce mois-ci (estim. 20 % du CA)
          </p>
          <p className="mt-3 rounded-xl bg-black/30 px-3 py-2 text-[11px] leading-relaxed text-orange-200/90 ring-1 ring-orange-500/20">
            L&apos;État sera réclamé ~{" "}
            <span className="font-semibold tabular-nums">
              {formatPrixFull(provisionTVA)}
            </span>{" "}
            sur la base du CA mensuel ({formatPrixFull(caMois)}).
          </p>
        </div>
      </motion.article>

      {/* KPI 3 — Budget réassort */}
      <motion.article
        variants={itemVariants}
        className="relative overflow-hidden rounded-[1.4rem] border border-fuchsia-400/35 bg-gradient-to-br from-fuchsia-600 via-violet-600 to-indigo-700 p-6 shadow-[0_20px_50px_-12px_rgba(147,51,234,0.45)] ring-1 ring-white/20 md:p-7"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_80%_20%,rgba(255,255,255,0.15),transparent)]"
          aria-hidden
        />
        <div className="relative">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white ring-1 ring-white/30">
              <ShoppingBag className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
              Safe to spend
            </span>
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-white">
            Budget réassort sécurisé
          </h3>
          <p className="mt-1 max-w-[20rem] text-xs leading-relaxed text-white/75">
            Ce que vous pouvez investir chez vos fournisseurs sans mettre la
            trésorerie en danger (après charges fixes et TVA).
          </p>
          <motion.p
            className={`mt-6 text-4xl font-semibold tabular-nums tracking-tight text-white md:text-5xl ${
              budgetSafe < 0 ? "text-amber-200" : ""
            }`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 120, damping: 18 }}
          >
            {formatPrixFull(budgetSafe)}
          </motion.p>
          {budgetSafe < 0 && (
            <p className="mt-2 text-xs font-medium text-amber-100">
              Solde insuffisant pour couvrir charges + TVA — prioriser l&apos;encaissement.
            </p>
          )}
        </div>
      </motion.article>
    </motion.div>
  );
}
