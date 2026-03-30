"use client";

import { Building2, Lock } from "lucide-react";

const MOCK_BALANCE = 14250;

const MOCK_TX = [
  { id: "1", type: "income" as const, amount: 1250, label: "Dépôt espèces" },
  { id: "2", type: "expense" as const, amount: 450, label: "Fournisseur Soie" },
  { id: "3", type: "expense" as const, amount: 60, label: "Électricité" },
];

function formatMoney(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export default function BankWidget({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6 text-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.35),inset_0_1px_0_0_rgba(255,255,255,0.08)] ring-1 ring-white/5 md:p-7 ${className}`}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-emerald-500/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl"
        aria-hidden
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm ring-1 ring-white/15">
              <Building2 className="h-5 w-5 text-white/90" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/60">
                Trésorerie
              </p>
              <p className="text-sm font-semibold tracking-tight text-white/95">
                Compte principal
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-emerald-200/90 ring-1 ring-white/10">
            Synchronisé il y a 2h
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-white/50">Solde actuel</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-white md:text-[2rem] md:leading-none">
              {formatMoney(MOCK_BALANCE)}
            </p>
          </div>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white/90 ring-1 ring-white/15 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Lock className="h-3.5 w-3.5" />
            Connecter ma banque
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            <span className="text-[11px] font-medium text-white/50">
              Données de démo
            </span>
          </span>
        </div>

        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
            Transactions récentes
          </p>
          <ul className="mt-3 space-y-2.5">
            {MOCK_TX.map((tx) => {
              const isIncome = tx.type === "income";
              return (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/[0.06]"
                >
                  <span className="min-w-0 truncate text-sm text-white/85">
                    {tx.label}
                  </span>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      isIncome ? "text-emerald-400" : "text-rose-300/85"
                    }`}
                  >
                    {isIncome ? "+" : "−"} {formatMoney(tx.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
