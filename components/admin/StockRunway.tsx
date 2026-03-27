"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Gauge, Sparkles, Package } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type ProduitRow = {
  id: string;
  nom: string;
  stock: number;
};

type RunwayItem = {
  id: string;
  nom: string;
  stock: number;
  velocity: number;
  daysRemaining: number;
};

const DAYS_WINDOW = 30;
const RUNWAY_THRESHOLD = 15;

function ceilDays(days: number): number {
  if (!Number.isFinite(days) || days < 0) return 0;
  return Math.max(0, Math.ceil(days));
}

export default function StockRunway() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [produitCount, setProduitCount] = useState(0);
  const [atRisk, setAtRisk] = useState<RunwayItem[]>([]);
  const [stable, setStable] = useState<Pick<ProduitRow, "id" | "nom" | "stock">[]>([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const from = new Date();
        from.setDate(from.getDate() - DAYS_WINDOW);
        const fromIso = from.toISOString();

        const [{ data: ventes, error: e1 }, { data: produits, error: e2 }] =
          await Promise.all([
            supabase.from("ventes").select("id").gte("created_at", fromIso),
            supabase.from("produits").select("id, nom, stock"),
          ]);

        if (e1 || e2) {
          setProduitCount(0);
          setAtRisk([]);
          setStable([]);
          return;
        }

        const venteIds = (ventes ?? []).map((v) => v.id as string);
        let qtyByProduct: Record<string, number> = {};

        if (venteIds.length > 0) {
          const { data: items } = await supabase
            .from("ventes_items")
            .select("produit_id, quantite")
            .in("vente_id", venteIds);

          qtyByProduct = {};
          (items ?? []).forEach(
            (row: { produit_id: string; quantite: number | null }) => {
              const id = row.produit_id;
              const q = row.quantite ?? 0;
              qtyByProduct[id] = (qtyByProduct[id] ?? 0) + q;
            }
          );
        }

        const rows = (produits ?? []) as ProduitRow[];
        setProduitCount(rows.length);
        const risk: RunwayItem[] = [];
        const stableRows: Pick<ProduitRow, "id" | "nom" | "stock">[] = [];

        for (const p of rows) {
          const sold = qtyByProduct[p.id] ?? 0;
          const velocity = sold / DAYS_WINDOW;

          if (velocity <= 0) {
            if (p.stock > 0) {
              stableRows.push({
                id: p.id,
                nom: p.nom,
                stock: p.stock,
              });
            }
            continue;
          }

          const daysRemaining = p.stock / velocity;
          if (daysRemaining < RUNWAY_THRESHOLD) {
            risk.push({
              id: p.id,
              nom: p.nom,
              stock: p.stock,
              velocity,
              daysRemaining,
            });
          }
        }

        risk.sort((a, b) => a.daysRemaining - b.daysRemaining);
        stableRows.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

        setAtRisk(risk);
        setStable(stableRows);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [supabase]);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-indigo-950/90 p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-inner">
            <Gauge className="h-6 w-6 text-amber-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
                Stock Runway
              </h2>
              <Sparkles className="h-5 w-5 text-amber-300/90" aria-hidden />
            </div>
            <p className="mt-1 max-w-xl text-sm text-white/60">
              Prédiction de rupture sur {DAYS_WINDOW} jours — vélocité = ventes
              totales ÷ {DAYS_WINDOW}. Seuil d&apos;alerte : moins de{" "}
              {RUNWAY_THRESHOLD} jours de couverture.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[160px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      ) : atRisk.length === 0 && stable.length === 0 ? (
        <p className="relative rounded-2xl border border-white/10 bg-white/5 px-5 py-8 text-center text-sm text-white/70">
          {produitCount === 0
            ? "Aucun produit dans le catalogue."
            : "Aucune rupture estimée sous 15 jours — couverture suffisante au vu de la vélocité actuelle."}
        </p>
      ) : (
        <div className="relative space-y-6">
          {atRisk.length > 0 && (
            <ul className="space-y-4">
              {atRisk.map((item) => {
                const days = ceilDays(item.daysRemaining);
                const urgent = days < 5;
                const barPct = Math.min(
                  100,
                  Math.max(4, (1 - Math.min(item.daysRemaining, RUNWAY_THRESHOLD) / RUNWAY_THRESHOLD) * 100)
                );

                return (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-white/25 bg-white/10 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition-all duration-300 hover:border-white/35 hover:bg-white/[0.14]"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 gap-y-2">
                          <Package className="h-4 w-4 shrink-0 text-white/50" />
                          <h3 className="truncate text-base font-semibold text-white">
                            {item.nom}
                          </h3>
                        </div>
                        <p className="mt-2 text-sm text-white/55">
                          Stock actuel :{" "}
                          <span className="font-medium tabular-nums text-white/90">
                            {item.stock}
                          </span>{" "}
                          unité{item.stock > 1 ? "s" : ""}
                          <span className="text-white/40"> · </span>
                          <span className="text-white/50">
                            {item.velocity.toFixed(2)} / jour
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                        <span
                          className={`inline-flex w-fit items-center justify-center rounded-full border px-4 py-2 text-center text-sm font-bold tracking-tight shadow-lg ${
                            urgent
                              ? "border-red-400/50 bg-red-500/25 text-red-100"
                              : "border-amber-400/40 bg-amber-500/20 text-amber-100"
                          }`}
                        >
                          Rupture estimée dans {days}{" "}
                          {days <= 1 ? "jour" : "jours"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                        {urgent ? (
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400"
                            style={{ width: `${barPct}%` }}
                            animate={{ opacity: [1, 0.45, 1] }}
                            transition={{
                              duration: 1.2,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                        ) : (
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all"
                            style={{ width: `${barPct}%` }}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {atRisk.length === 0 && stable.length > 0 && (
            <p className="relative rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/90">
              Aucune rupture prévue sous {RUNWAY_THRESHOLD} jours selon la
              vélocité actuelle.
            </p>
          )}

          {stable.length > 0 && (
            <div className="relative rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-md">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
                Pas de vente sur {DAYS_WINDOW} jours — stock stable
              </p>
              <ul className="flex flex-wrap gap-2">
                {stable.map((s) => (
                  <li
                    key={s.id}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/85"
                  >
                    <span className="max-w-[140px] truncate font-medium">
                      {s.nom}
                    </span>
                    <span className="rounded-full bg-emerald-500/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                      Stock stable
                    </span>
                    <span className="tabular-nums text-white/50">×{s.stock}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
