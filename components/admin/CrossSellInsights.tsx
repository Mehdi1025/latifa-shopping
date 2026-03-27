"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type VenteItemRow = {
  vente_id: string;
  produit_id: string;
};

type ProduitRow = {
  id: string;
  nom: string;
};

export type DuoInsight = {
  idA: string;
  idB: string;
  nomA: string;
  nomB: string;
  count: number;
  pctOfMultiBaskets: number | null;
};

/** Compte les paires de produits distincts par panier (vente_id). */
export function computeTopProductPairs(
  items: VenteItemRow[],
  nomById: Record<string, string>,
  topN: number
): { duos: DuoInsight[]; totalMultiItemBaskets: number } {
  const byVente = new Map<string, Set<string>>();
  for (const row of items) {
    const vid = row.vente_id;
    const pid = row.produit_id;
    if (!vid || !pid) continue;
    if (!byVente.has(vid)) byVente.set(vid, new Set());
    byVente.get(vid)!.add(pid);
  }

  const pairCounts = new Map<string, number>();
  let totalMultiItemBaskets = 0;

  for (const [, ids] of byVente) {
    const list = Array.from(ids).sort((a, b) => a.localeCompare(b));
    if (list.length < 2) continue;
    totalMultiItemBaskets += 1;

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const key = `${list[i]}\0${list[j]}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const sorted = [...pairCounts.entries()]
    .map(([key, count]) => {
      const [idA, idB] = key.split("\0");
      return {
        idA,
        idB,
        nomA: nomById[idA] ?? "Produit",
        nomB: nomById[idB] ?? "Produit",
        count,
        pctOfMultiBaskets:
          totalMultiItemBaskets > 0
            ? Math.round((count / totalMultiItemBaskets) * 1000) / 10
            : null,
      };
    })
    .sort((a, b) => b.count - a.count);

  const duos = sorted.slice(0, topN);

  return { duos, totalMultiItemBaskets };
}

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.06,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

export default function CrossSellInsights() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [duos, setDuos] = useState<DuoInsight[]>([]);
  const [totalMultiBaskets, setTotalMultiBaskets] = useState(0);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const [{ data: items, error: e1 }, { data: produits, error: e2 }] =
          await Promise.all([
            supabase
              .from("ventes_items")
              .select("vente_id, produit_id"),
            supabase.from("produits").select("id, nom"),
          ]);

        if (e1 || e2) {
          setDuos([]);
          setTotalMultiBaskets(0);
          return;
        }

        const nomById = Object.fromEntries(
          ((produits ?? []) as ProduitRow[]).map((p) => [p.id, p.nom])
        );

        const { duos: top, totalMultiItemBaskets } = computeTopProductPairs(
          (items ?? []) as VenteItemRow[],
          nomById,
          3
        );
        setDuos(top);
        setTotalMultiBaskets(totalMultiItemBaskets);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [supabase]);

  return (
    <section className="relative mb-8 overflow-hidden rounded-3xl border border-slate-200/60 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-6 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.35)] md:p-8">
      <div className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative mb-6">
        <h2 className="text-lg font-semibold tracking-tight text-white md:text-xl">
          💡 Opportunités de Ventes Croisées
        </h2>
        <p className="mt-1 text-sm text-white/55">
          Duos les plus souvent achetés dans le même panier (historique complet).
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[140px] items-center justify-center py-8">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
        </div>
      ) : duos.length === 0 ? (
        <p className="relative rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/65">
          Pas assez de données : il faut des paniers contenant au moins deux
          produits distincts pour détecter des duos.
        </p>
      ) : (
        <motion.ul
          className="relative space-y-4"
          variants={listVariants}
          initial="hidden"
          animate="show"
        >
          {duos.map((d) => (
            <motion.li
              key={`${d.idA}-${d.idB}`}
              variants={cardVariants}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner backdrop-blur-xl md:flex-row md:items-center md:justify-between md:gap-6 md:p-5"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm font-medium text-white md:text-base">
                  <span className="truncate rounded-lg bg-white/10 px-3 py-2">
                    {d.nomA}
                  </span>
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-amber-200"
                    aria-hidden
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                  </span>
                  <span className="truncate rounded-lg bg-white/10 px-3 py-2">
                    {d.nomB}
                  </span>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100">
                    Achetés ensemble {d.count} fois
                  </span>
                  {d.pctOfMultiBaskets != null && totalMultiBaskets > 0 && (
                    <span className="text-xs text-white/45">
                      ({d.pctOfMultiBaskets}% des paniers multi-articles)
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-4 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-relaxed text-white/70 md:mt-0 md:max-w-sm md:border-l md:border-t-0 md:pl-6 md:pt-0">
                <span className="mt-0.5 shrink-0 text-base" aria-hidden>
                  ✨
                </span>
                <span>
                  <span className="font-medium text-white/85">Conseil :</span>{" "}
                  Créez une offre promotionnelle sur ce duo pour augmenter votre
                  panier moyen.
                </span>
              </p>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </section>
  );
}
