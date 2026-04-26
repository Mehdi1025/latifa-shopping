"use client";

function formatFondEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

type Props = {
  fondHeredite: number;
  onOpen: () => void;
  loading: boolean;
  error: string | null;
  /** 100 € par défaut et aucune clôture antérieure en base (premier jour) */
  estPremierJour: boolean;
};

export default function CaisseLockScreen({
  fondHeredite,
  onOpen,
  loading,
  error,
  estPremierJour,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100/80 px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-gray-200/80 bg-white p-8 shadow-xl shadow-gray-200/50 ring-1 ring-gray-100">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">🔒 Caisse Fermée</h1>
          <p className="mt-2 text-sm text-gray-600">
            {estPremierJour
              ? "Premier jour d’exploitation : le fond de départ est fixé par défaut."
              : "Le fond initial provient du comptage physique de la dernière clôture."}
          </p>
        </div>
        <div className="mb-1.5 text-sm font-medium text-gray-700">Fond initial (ouverture)</div>
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-amber-950">
            {formatFondEur(fondHeredite)}
          </p>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={onOpen}
          disabled={loading}
          className="mt-6 flex w-full min-h-[52px] items-center justify-center rounded-2xl bg-gray-900 py-3.5 text-base font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Ouverture…" : "Ouvrir la caisse"}
        </button>
      </div>
    </div>
  );
}
