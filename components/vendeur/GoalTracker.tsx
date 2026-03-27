"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { MessageCircle, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useObjectifDuJour } from "@/hooks/useObjectifDuJour";

const PRIME_RATE = 0.03;

function getTodayBounds(): { start: string; end: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function triggerGoldConfetti() {
  const defaults = { origin: { y: 0.55 }, zIndex: 4000 };
  confetti({
    ...defaults,
    particleCount: 90,
    spread: 70,
    startVelocity: 45,
    colors: ["#fbbf24", "#f59e0b", "#ea580c", "#fcd34d", "#fef3c7"],
  });
  confetti({
    ...defaults,
    particleCount: 60,
    spread: 100,
    decay: 0.92,
    scalar: 0.9,
    colors: ["#fbbf24", "#d97706", "#fffbeb"],
  });
}

export default function GoalTracker() {
  const supabase = createSupabaseBrowserClient();
  const {
    montantCible: objectifJour,
    noteDuJour,
    loading: loadingObjectif,
  } = useObjectifDuJour();
  const [totalDuJour, setTotalDuJour] = useState(0);
  const [loadingVentes, setLoadingVentes] = useState(true);
  const celebratedRef = useRef(false);
  const prevObjectifRef = useRef<number | null>(null);

  const fetchTotal = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setTotalDuJour(0);
      setLoadingVentes(false);
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
      setLoadingVentes(false);
      return;
    }
    const sum = (data ?? []).reduce((acc, row) => {
      const t = row as { total: number | null };
      return acc + (Number(t.total) || 0);
    }, 0);
    setTotalDuJour(sum);
    setLoadingVentes(false);
  }, [supabase]);

  useEffect(() => {
    fetchTotal();
  }, [fetchTotal]);

  useEffect(() => {
    const id = setInterval(fetchTotal, 30000);
    return () => clearInterval(id);
  }, [fetchTotal]);

  const loading = loadingVentes || loadingObjectif;

  const pct = Math.min(
    100,
    objectifJour > 0 ? (totalDuJour / objectifJour) * 100 : 0
  );
  const reste = Math.max(0, objectifJour - totalDuJour);
  const primeEstimee = totalDuJour * PRIME_RATE;
  const objectifAtteint = totalDuJour >= objectifJour;

  useEffect(() => {
    if (prevObjectifRef.current !== objectifJour) {
      prevObjectifRef.current = objectifJour;
      celebratedRef.current = totalDuJour >= objectifJour;
    }
  }, [objectifJour, totalDuJour]);

  useEffect(() => {
    if (loading || !objectifAtteint || celebratedRef.current) return;
    celebratedRef.current = true;
    const id = window.setTimeout(() => triggerGoldConfetti(), 450);
    return () => clearTimeout(id);
  }, [loading, objectifAtteint]);

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.07] p-6 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-8 dark:bg-black/25"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/[0.06] via-transparent to-orange-600/[0.05]" />

      {noteDuJour && (
        <div className="relative mb-5 flex flex-wrap items-start gap-2 rounded-2xl border border-indigo-200/50 bg-indigo-50/90 px-4 py-3 text-sm text-indigo-950 shadow-sm backdrop-blur-sm dark:border-indigo-500/25 dark:bg-indigo-950/40 dark:text-indigo-100">
          <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500 dark:text-indigo-300" />
          <p>
            <span className="font-semibold">Note du jour :</span>{" "}
            <span className="font-medium">{noteDuJour}</span>
          </p>
        </div>
      )}

      <div className="relative mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">
            Objectif du jour
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-white/40">
            Somme de vos ventes encaissées aujourd&apos;hui
          </p>
        </div>
        {objectifAtteint && !loading && (
          <motion.span
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-950 shadow-[0_0_28px_rgba(251,191,36,0.55)]"
          >
            <span aria-hidden>🏆</span> Objectif Atteint
          </motion.span>
        )}
      </div>

      {/* Jauge liquide */}
      <div className="relative mb-8">
        <div className="relative h-16 overflow-hidden rounded-2xl border border-white/20 bg-slate-200/30 shadow-inner ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10 md:h-[4.5rem]">
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-white/5 dark:from-white/[0.08] dark:to-transparent" />

          <motion.div
            className="absolute inset-y-0 left-0 overflow-hidden rounded-r-2xl"
            initial={{ width: "0%" }}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", damping: 28, stiffness: 120, delay: 0.15 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-amber-400 to-orange-500" />
            <motion.div
              className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-80"
              initial={{ x: "-100%" }}
              animate={{ x: ["100%", "-100%"] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute -bottom-1 left-0 right-0 h-3 rounded-[100%] bg-white/25 blur-sm"
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 2.2, repeat: Infinity }}
            />
          </motion.div>

          <div className="absolute inset-0 flex items-center justify-center px-4">
            <span
              className="relative text-lg font-bold tabular-nums text-slate-800 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)] dark:text-white dark:drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] md:text-xl"
              style={{
                textShadow:
                  "0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(251,191,36,0.35)",
              }}
            >
              {loading ? "—" : `${Math.round(pct)}%`}
            </span>
          </div>
        </div>

        <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-center text-xs text-slate-600 dark:text-white/50">
          <span className="font-medium text-slate-800 dark:text-white/80">
            {loading ? "…" : formatEur(totalDuJour)}
          </span>
          <span className="text-slate-400">/</span>
          <span>{formatEur(objectifJour)}</span>
        </p>
      </div>

      <div className="relative grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-sm dark:bg-white/[0.04]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
            <TrendingUp className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/40">
              Reste à vendre
            </p>
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {loading ? "…" : formatEur(reste)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-sm dark:bg-white/[0.04]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-300">
            <Wallet className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/40">
              Prime estimée (3&nbsp;%)
            </p>
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {loading ? "…" : formatEur(primeEstimee)}
            </p>
          </div>
        </div>
      </div>

      <p className="relative mt-5 flex items-center justify-center gap-2 text-center text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-white/30">
        <Sparkles className="h-3.5 w-3.5" />
        Chaque vente vous rapproche du sommet
      </p>
    </div>
  );
}
