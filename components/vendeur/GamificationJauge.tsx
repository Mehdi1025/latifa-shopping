"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Target } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

/** Objectif journalier fixe (CA encaissé, somme des `ventes.total` du jour). */
export const OBJECTIF_JOUR = 1000;

function formatEurCompact(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function getTodayBounds(): { start: string; end: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function triggerGoalConfetti() {
  const count = 200;
  const defaults = { origin: { y: 0.65 }, zIndex: 3000 };

  confetti({
    ...defaults,
    particleCount: Math.floor(count * 0.25),
    spread: 26,
    startVelocity: 55,
    colors: ["#fbbf24", "#f59e0b", "#ea580c", "#fcd34d", "#fff7ed"],
  });
  confetti({
    ...defaults,
    particleCount: Math.floor(count * 0.2),
    spread: 60,
    colors: ["#fbbf24", "#f59e0b", "#fcd34d"],
  });
  confetti({
    ...defaults,
    particleCount: Math.floor(count * 0.35),
    spread: 100,
    decay: 0.91,
    scalar: 0.85,
    colors: ["#fbbf24", "#ea580c", "#fffbeb"],
  });
}

type GamificationJaugeProps = {
  /** Incrémenter après une vente ou annulation pour rafraîchir tout de suite. */
  refreshKey?: number;
  className?: string;
};

export default function GamificationJauge({
  refreshKey = 0,
  className = "",
}: GamificationJaugeProps) {
  const supabase = createSupabaseBrowserClient();
  const [totalDuJour, setTotalDuJour] = useState(0);
  const [loading, setLoading] = useState(true);
  const prevTotalRef = useRef<number | null>(null);
  const hasFiredConfettiForSession = useRef(false);

  const fetchTotalDuJour = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setTotalDuJour(0);
      setLoading(false);
      return;
    }

    const { start, end } = getTodayBounds();
    const { data, error } = await supabase
      .from("ventes")
      .select("total")
      .eq("vendeur_id", user.id)
      .gte("created_at", start)
      .lte("created_at", end);

    if (error) {
      setTotalDuJour(0);
      setLoading(false);
      return;
    }

    const sum = (data ?? []).reduce(
      (acc, row) => acc + (Number(row.total) || 0),
      0
    );
    setTotalDuJour(sum);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchTotalDuJour();
  }, [fetchTotalDuJour, refreshKey]);

  useEffect(() => {
    const id = setInterval(fetchTotalDuJour, 30000);
    return () => clearInterval(id);
  }, [fetchTotalDuJour]);

  const pct = Math.min(
    100,
    OBJECTIF_JOUR > 0 ? (totalDuJour / OBJECTIF_JOUR) * 100 : 0
  );
  const reste = Math.max(0, OBJECTIF_JOUR - totalDuJour);
  const atteint = totalDuJour >= OBJECTIF_JOUR;

  useEffect(() => {
    const prev = prevTotalRef.current;
    prevTotalRef.current = totalDuJour;

    if (prev === null) {
      if (totalDuJour >= OBJECTIF_JOUR) {
        hasFiredConfettiForSession.current = true;
      }
      return;
    }

    if (
      prev < OBJECTIF_JOUR &&
      totalDuJour >= OBJECTIF_JOUR &&
      !hasFiredConfettiForSession.current
    ) {
      hasFiredConfettiForSession.current = true;
      triggerGoalConfetti();
    }

    if (totalDuJour < OBJECTIF_JOUR) {
      hasFiredConfettiForSession.current = false;
    }
  }, [totalDuJour]);

  return (
    <div
      className={`rounded-2xl border border-white/60 bg-white/40 p-4 shadow-sm backdrop-blur-md ring-1 ring-black/[0.04] dark:border-white/10 dark:bg-black/5 dark:ring-white/10 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
          <Target className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
            Objectif du jour
          </span>
        </div>
        {!loading && (
          <span className="text-xs font-medium tabular-nums text-gray-600 dark:text-gray-300">
            {formatEurCompact(totalDuJour)}
            <span className="text-gray-400"> / </span>
            {formatEurCompact(OBJECTIF_JOUR)}
          </span>
        )}
      </div>

      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-200/80 dark:bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 shadow-[0_0_12px_rgba(251,191,36,0.45)]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", damping: 28, stiffness: 180 }}
        />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
        {loading ? (
          <span className="text-gray-400">Chargement…</span>
        ) : atteint ? (
          <>🏆 Objectif atteint ! Excellent travail !</>
        ) : (
          <>
            🚀 Plus que {formatEurCompact(reste)} pour atteindre
            l&apos;objectif du jour !
          </>
        )}
      </p>
    </div>
  );
}
