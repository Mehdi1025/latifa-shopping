"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, Loader2, Save, Target } from "lucide-react";
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
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function next7Days(): { jour: string; label: string }[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const jour = addDaysISO(today, i);
    return { jour, label: formatLabel(jour) };
  });
}

export default function AdminObjectifsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<JourPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    setRows(
      next7Days().map(({ jour, label }) => ({
        jour,
        label,
        montant: "1000",
        taux: "",
        note: "",
      }))
    );
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

    setRows(
      days.map(({ jour, label }) => {
        const o = byJour[jour];
        return {
          jour,
          label,
          montant: o?.montant ?? "1000",
          taux: o?.taux ?? "",
          note: o?.note ?? "",
        };
      })
    );
    setLoading(false);
  }, [supabase, initEmpty]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateRow = (jour: string, patch: Partial<Pick<JourPlan, "montant" | "taux" | "note">>) => {
    setRows((prev) =>
      prev.map((r) => (r.jour === jour ? { ...r, ...patch } : r))
    );
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
      toast.success("Planification enregistrée. Les vendeuses verront les changements en direct.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-container min-h-dvh bg-gradient-to-b from-slate-50 to-slate-100/80 p-4 md:p-6 lg:p-10">
      <header className="mb-8 max-w-4xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
            <Target className="h-6 w-6" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
              Pilotage des objectifs
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Planifiez le montant cible (€), le taux de conversion visé (%) et une note
              pour chaque jour — les jauges vendeuses suivent ces valeurs.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-sm md:px-6">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays className="h-5 w-5 text-indigo-500" />
            <span>
              Fenêtre : <strong className="text-slate-800">7 prochains jours</strong> à partir
              d&apos;aujourd&apos;hui ({formatLabel(localDateISO())})
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            Enregistrer la planification
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          </div>
        ) : (
          <ul className="space-y-4">
            {rows.map((r, i) => (
              <motion.li
                key={r.jour}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm md:p-6"
              >
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
                  <span className="text-lg font-semibold capitalize text-slate-900">
                    {r.label}
                  </span>
                  <span className="font-mono text-xs text-slate-400">{r.jour}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Montant cible (€)
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={r.montant}
                      onChange={(e) => updateRow(r.jour, { montant: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-slate-900 outline-none ring-indigo-500/0 transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/15"
                      placeholder="1000"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Taux de conversion visé (%)
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={r.taux}
                      onChange={(e) => updateRow(r.jour, { taux: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-slate-900 outline-none ring-indigo-500/0 transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/15"
                      placeholder="ex. 12"
                    />
                  </label>
                </div>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Note du jour (visible vendeuses)
                  </span>
                  <textarea
                    value={r.note}
                    onChange={(e) => updateRow(r.jour, { note: e.target.value })}
                    rows={2}
                    className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none ring-indigo-500/0 transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/15"
                    placeholder="Message court pour l’équipe…"
                  />
                </label>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
