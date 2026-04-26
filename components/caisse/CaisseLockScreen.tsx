"use client";

import { useState } from "react";
type Props = {
  fond: string;
  onFondChange: (v: string) => void;
  onOpen: () => void;
  loading: boolean;
  error: string | null;
};

function parseFondInput(raw: string): number {
  const s = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return NaN;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export default function CaisseLockScreen({
  fond,
  onFondChange,
  onOpen,
  loading,
  error,
}: Props) {
  const [localTouched, setLocalTouched] = useState(false);
  const n = parseFondInput(fond);
  const valid = n >= 0 && !Number.isNaN(n);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100/80 px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-gray-200/80 bg-white p-8 shadow-xl shadow-gray-200/50 ring-1 ring-gray-100">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">🔒 Caisse Fermée</h1>
          <p className="mt-2 text-sm text-gray-600">
            Saisissez le fond de caisse pour commencer la vente.
          </p>
        </div>
        <label
          className="mb-1.5 block text-sm font-medium text-gray-700"
          htmlFor="fond-caisse"
        >
          Fond de caisse (Montant au démarrage)
        </label>
        <div className="relative">
          <input
            id="fond-caisse"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={fond}
            onChange={(e) => {
              onFondChange(e.target.value);
              setLocalTouched(true);
            }}
            onBlur={() => setLocalTouched(true)}
            placeholder="0,00"
            className="w-full rounded-2xl border border-gray-200 bg-gray-50/80 py-3.5 pl-4 pr-12 text-lg font-semibold text-gray-900 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
            €
          </span>
        </div>
        {localTouched && fond.trim() !== "" && !valid && (
          <p className="mt-2 text-sm text-red-600">Montant invalide.</p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={onOpen}
          disabled={loading || !valid}
          className="mt-6 flex w-full min-h-[52px] items-center justify-center rounded-2xl bg-gray-900 py-3.5 text-base font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Ouverture…" : "Ouvrir la caisse"}
        </button>
      </div>
    </div>
  );
}
