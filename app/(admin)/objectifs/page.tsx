"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  Euro,
  Loader2,
  MessageSquareText,
  Percent,
  RotateCcw,
  Save,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { localDateISO } from "@/hooks/useObjectifDuJour";

type JourPlan = {
  jour: string;
  label: string;
  montant: string;
  taux: string;
  note: string;
};

function addDaysISO(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return localDateISO(d);
}

function formatLabel(dateStr: string): string {
  const [y, m, day] = dateStr.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatLabelShort(dateStr: string): string {
  const [y, m, day] = dateStr.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function next7Days(): { jour: string; label: string }[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const jour = addDaysISO(today, i);
    return { jour, label: formatLabelShort(jour) };
  });
}

function parseMontant(s: string): number {
  const n = parseFloat(String(s).replace(",", ".").trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function cloneRows(rows: JourPlan[]): JourPlan[] {
  return rows.map((r) => ({ ...r }));
}

export default function AdminObjectifsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<JourPlan[]>([]);
  const [baseline, setBaseline] = useState<JourPlan[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const todayKey = localDateISO();

  useEffect(() => {
    const guard = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const role = (profile as { role?: string } | null)?.role?.toLowerCase()?.trim();
      if (role !== "admin") {
        router.replace("/vendeuse");
      }
    };
    void guard();
  }, [router, supabase]);

  const initEmpty = useCallback(() => {
    const next = next7Days().map(({ jour, label }) => ({
      jour,
      label,
      montant: "1000",
      taux: "",
      note: "",
    }));
    setRows(next);
    setBaseline(cloneRows(next));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const days = next7Days();
    const jours = days.map((d) => d.jour);

    const { data, error } = await supabase
      .from("objectifs_journaliers")
      .select("jour, montant_cible, taux_conversion, note_du_jour")
      .in("jour", jours);

    if (error) {
      toast.error(error.message || "Impossible de charger les objectifs.");
      initEmpty();
      setLoading(false);
      return;
    }

    const byJour = Object.fromEntries(
      (data ?? []).map((r) => {
        const row = r as {
          jour: string;
          montant_cible: number | null;
          taux_conversion: number | null;
          note_du_jour: string | null;
        };
        return [
          row.jour,
          {
            montant:
              row.montant_cible != null ? String(row.montant_cible) : "1000",
            taux:
              row.taux_conversion != null && !Number.isNaN(Number(row.taux_conversion))
                ? String(row.taux_conversion)
                : "",
            note: row.note_du_jour ?? "",
          },
        ];
      })
    );

    const loaded = days.map(({ jour, label }) => {
      const o = byJour[jour];
      return {
        jour,
        label,
        montant: o?.montant ?? "1000",
        taux: o?.taux ?? "",
        note: o?.note ?? "",
      };
    });
    setRows(loaded);
    setBaseline(cloneRows(loaded));
    setLoading(false);
  }, [supabase, initEmpty]);

  useEffect(() => {
    void load();
  }, [load]);

  const isDirty = useMemo(() => {
    if (!baseline || rows.length !== baseline.length) return false;
    return JSON.stringify(rows) !== JSON.stringify(baseline);
  }, [rows, baseline]);

  const stats = useMemo(() => {
    let total = 0;
    let tauxSum = 0;
    let tauxCount = 0;
    rows.forEach((r) => {
      total += parseMontant(r.montant);
      const t = String(r.taux).replace(",", ".").trim();
      if (t !== "") {
        const v = parseFloat(t);
        if (Number.isFinite(v)) {
          tauxSum += v;
          tauxCount += 1;
        }
      }
    });
    return {
      total,
      avgTaux: tauxCount > 0 ? tauxSum / tauxCount : null,
      tauxCount,
    };
  }, [rows]);

  const updateRow = (
    jour: string,
    patch: Partial<Pick<JourPlan, "montant" | "taux" | "note">>
  ) => {
    setRows((prev) =>
      prev.map((r) => (r.jour === jour ? { ...r, ...patch } : r))
    );
  };

  const handleReset = () => {
    if (!baseline) return;
    setRows(cloneRows(baseline));
    toast.message("Formulaire réinitialisé", {
      description: "Les valeurs enregistrées ont été rechargées.",
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = rows.map((r) => {
        const montant = parseFloat(String(r.montant).replace(",", "."));
        const tauxRaw = String(r.taux).replace(",", ".").trim();
        const taux = tauxRaw === "" ? null : parseFloat(tauxRaw);

        return {
          jour: r.jour,
          montant_cible: Number.isFinite(montant) && montant >= 0 ? montant : 1000,
          taux_conversion:
            taux != null && Number.isFinite(taux) ? Math.min(100, Math.max(0, taux)) : null,
          note_du_jour: r.note.trim() || null,
          updated_at: new Date().toISOString(),
        };
      });

      const { error } = await supabase.from("objectifs_journaliers").upsert(payload, {
        onConflict: "jour",
      });

      if (error) throw error;
      toast.success("Objectifs enregistrés", {
        description:
          "L’équipe voit les montants, taux et notes en direct sur les jauges.",
        duration: 4000,
        className:
          "!rounded-2xl !border !border-emerald-400/40 !bg-emerald-950/95 !text-emerald-50",
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.35,
        ease: [0.25, 0.46, 0.45, 0.94] as const,
      },
    },
  };

  return (
    <div className="admin-container relative min-h-dvh overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-4 md:p-6 lg:p-10">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(99,102,241,0.11),transparent)]"
        aria-hidden
      />

      <header className="relative mb-8 max-w-5xl lg:mb-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-600/25 ring-1 ring-white/20">
              <Target className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                  Objectifs &amp; planification
                </h1>
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  7 jours
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-[15px]">
                Définissez le <strong className="font-semibold text-slate-800">CA cible</strong>, le{" "}
                <strong className="font-semibold text-slate-800">taux de conversion</strong> visé et une{" "}
                <strong className="font-semibold text-slate-800">note</strong> pour chaque jour — les
                vendeuses les voient instantanément sur leur espace.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-5xl space-y-6 pb-28 md:pb-8">
        {/* Synthèse */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] backdrop-blur-xl ring-1 ring-slate-200/50">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Total CA cible (7 j.)
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
              {loading ? "—" : formatEur(stats.total)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] backdrop-blur-xl ring-1 ring-slate-200/50">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Moy. journalière
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
              {loading ? "—" : formatEur(rows.length ? stats.total / rows.length : 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] backdrop-blur-xl ring-1 ring-slate-200/50">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Taux (moy. saisis)
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
              {loading
                ? "—"
                : stats.avgTaux != null
                  ? `${stats.avgTaux.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`
                  : "—"}
            </p>
            {!loading && stats.tauxCount > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                sur {stats.tauxCount} jour{stats.tauxCount > 1 ? "s" : ""}
              </p>
            )}
          </div>
        </motion.div>

        {/* Barre d’actions — sticky mobile */}
        <div className="sticky top-0 z-30 -mx-4 flex flex-col gap-3 border-b border-slate-200/60 bg-white/75 px-4 py-3 backdrop-blur-xl md:static md:mx-0 md:rounded-2xl md:border md:border-slate-200/80 md:bg-white/90 md:px-5 md:py-3 md:shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm text-slate-600">
              <CalendarDays className="h-5 w-5 shrink-0 text-indigo-500" />
              <span className="min-w-0">
                Fenêtre :{" "}
                <strong className="text-slate-800">7 jours</strong> à partir d&apos;aujourd&apos;hui
                <span className="hidden sm:inline">
                  {" "}
                  · <span className="capitalize">{formatLabel(todayKey)}</span>
                </span>
              </span>
              <AnimatePresence mode="wait">
                {isDirty && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="inline-flex md:hidden items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900"
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    Brouillon
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="hidden flex-wrap items-center gap-2 md:flex">
              <AnimatePresence mode="wait">
                {isDirty && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900"
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    Non enregistré
                  </motion.span>
                )}
              </AnimatePresence>
              <button
                type="button"
                onClick={handleReset}
                disabled={!isDirty || saving || loading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Réinitialiser
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || loading || !isDirty}
                className="inline-flex min-w-[10rem] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Enregistrer
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-28">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
            <p className="text-sm text-slate-500">Chargement des objectifs…</p>
          </div>
        ) : (
          <motion.ul
            className="space-y-4"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {rows.map((r) => {
              const isToday = r.jour === todayKey;
              const [y, m, d] = r.jour.split("-").map(Number);
              const wd = new Date(y, m - 1, d).getDay();
              const isWeekend = wd === 0 || wd === 6;

              return (
                <motion.li key={r.jour} variants={itemVariants} layout>
                  <div
                    className={`overflow-hidden rounded-[1.25rem] border bg-white/80 shadow-[0_8px_40px_-16px_rgba(0,0,0,0.08)] backdrop-blur-xl transition hover:shadow-[0_12px_40px_-12px_rgba(99,102,241,0.12)] ${
                      isToday
                        ? "border-indigo-400/70 ring-2 ring-indigo-400/25"
                        : isWeekend
                          ? "border-amber-200/60 bg-amber-50/20"
                          : "border-slate-200/80"
                    }`}
                  >
                    <div
                      className={`flex flex-col gap-4 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6 ${
                        isToday
                          ? "border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-transparent"
                          : "border-slate-100 bg-slate-50/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums ${
                            isToday
                              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                              : "bg-slate-200/80 text-slate-700"
                          }`}
                        >
                          {d}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-semibold capitalize text-slate-900 md:text-lg">
                              {r.label}
                            </span>
                            {isToday && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                <Sparkles className="h-3 w-3" />
                                Aujourd&apos;hui
                              </span>
                            )}
                            {isWeekend && !isToday && (
                              <span className="rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                                Week-end
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 font-mono text-[11px] text-slate-400">{r.jour}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-5 p-5 md:grid-cols-2 md:gap-6 md:px-6 md:pb-6 md:pt-5">
                      <label className="group block">
                        <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                            <Euro className="h-3.5 w-3.5" strokeWidth={2} />
                          </span>
                          Montant cible
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={r.montant}
                          onChange={(e) => updateRow(r.jour, { montant: e.target.value })}
                          className="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-lg font-medium tabular-nums text-slate-900 outline-none ring-indigo-500/0 transition placeholder:text-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/12"
                          placeholder="1000"
                          aria-label={`Montant cible en euros pour ${r.label}`}
                        />
                        <span className="mt-1.5 block text-[11px] text-slate-400">Euros HT / jour</span>
                      </label>

                      <label className="group block">
                        <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                            <Percent className="h-3.5 w-3.5" strokeWidth={2} />
                          </span>
                          Taux de conversion visé
                        </span>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={r.taux}
                            onChange={(e) => updateRow(r.jour, { taux: e.target.value })}
                            className="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 pr-10 text-lg font-medium tabular-nums text-slate-900 outline-none ring-indigo-500/0 transition placeholder:text-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/12"
                            placeholder="ex. 12"
                            aria-label={`Taux de conversion pour ${r.label}`}
                          />
                          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                            %
                          </span>
                        </div>
                        <span className="mt-1.5 block text-[11px] text-slate-400">
                          Optionnel — laissez vide si non défini
                        </span>
                      </label>

                      <label className="group md:col-span-2">
                        <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
                            <MessageSquareText className="h-3.5 w-3.5" strokeWidth={2} />
                          </span>
                          Note du jour (équipe)
                        </span>
                        <textarea
                          value={r.note}
                          onChange={(e) => updateRow(r.jour, { note: e.target.value })}
                          rows={2}
                          className="w-full resize-y rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none ring-indigo-500/0 transition placeholder:text-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/12"
                          placeholder="Consigne courte, motivation, focus produit…"
                          aria-label={`Note pour ${r.label}`}
                        />
                      </label>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </div>

      {/* Barre fixe mobile : même actions */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.08)] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty || saving || loading}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm disabled:opacity-40"
          >
            Réinit.
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading || !isDirty}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 disabled:opacity-45"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
