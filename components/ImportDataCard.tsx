"use client";

import { MoreHorizontal, ExternalLink } from "lucide-react";

const integrations = [
  {
    name: "Shopify",
    label: "Boutique en ligne",
    color: "from-emerald-500 to-emerald-600",
    letter: "S",
  },
  {
    name: "SumUp",
    label: "Paiements CB",
    color: "from-blue-500 to-blue-600",
    letter: "U",
  },
  {
    name: "Stripe",
    label: "Paiements en ligne",
    color: "from-violet-500 to-violet-600",
    letter: "P",
  },
];

export default function ImportDataCard() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 transition-all duration-300 ease-in-out hover:scale-[1.01] hover:shadow-lg">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-slate-900">
            Importer des données dans Latifa Shop
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            Connectez vos sources pour synchroniser les ventes, stocks et clients.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg p-2 text-slate-400 transition-all duration-300 ease-in-out hover:bg-slate-100 hover:text-slate-600"
          aria-label="Plus d'options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      <ul className="space-y-3">
        {integrations.map((item) => (
          <li
            key={item.name}
            className="group flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/30 p-4 transition-all duration-300 ease-in-out hover:border-slate-200 hover:bg-white hover:shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} text-sm font-bold text-white shadow-sm`}
              >
                {item.letter}
              </div>
              <div>
                <p className="font-medium text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">{item.label}</p>
              </div>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all duration-300 ease-in-out hover:bg-indigo-700"
            >
              Lancer l&apos;import
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs leading-relaxed text-slate-500">
        Ou vous pouvez{" "}
        <button
          type="button"
          className="font-medium text-indigo-600 transition-colors hover:text-indigo-700 hover:underline"
        >
          synchroniser les données manuellement
        </button>{" "}
        vers Latifa Shop...
      </p>
    </section>
  );
}
