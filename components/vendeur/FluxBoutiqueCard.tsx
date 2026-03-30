"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Minus, Plus, Save, Loader2, Check } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { localDateISO } from "@/hooks/useObjectifDuJour";

export default function FluxBoutiqueCard() {
  const supabase = createSupabaseBrowserClient();
  const [nombre, setNombre] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const jour = localDateISO();

  const fetchToday = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("daily_traffic")
      .select("nombre_entrees")
      .eq("jour", jour)
      .maybeSingle();

    if (err) {
      setError(err.message);
      setNombre(0);
    } else {
      const n = (data as { nombre_entrees?: number } | null)?.nombre_entrees;
      setNombre(typeof n === "number" && !Number.isNaN(n) ? Math.max(0, n) : 0);
    }
    setLoading(false);
  }, [supabase, jour]);

  useEffect(() => {
    void fetchToday();
  }, [fetchToday]);

  const bump = (delta: number) => {
    setNombre((prev) => Math.max(0, prev + delta));
    setSavedOk(false);
  };

  const handleInput = (raw: string) => {
    if (raw === "") {
      setNombre(0);
      setSavedOk(false);
      return;
    }
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return;
    setNombre(Math.max(0, n));
    setSavedOk(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSavedOk(false);
    const { error: err } = await supabase.from("daily_traffic").upsert(
      {
        jour,
        nombre_entrees: nombre,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "jour" }
    );
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSavedOk(true);
    window.setTimeout(() => setSavedOk(false), 3500);
  };

  return (
    <section className="mb-5 rounded-2xl border border-gray-100 bg-white/90 p-4 shadow-sm ring-1 ring-gray-100/80 backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/5">
          <Users className="h-5 w-5 text-slate-700" strokeWidth={1.75} aria-hidden />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Flux Boutique</h2>
          <p className="text-xs text-gray-500">Entrées aujourd&apos;hui</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => bump(-1)}
              className="flex h-11 min-h-[44px] w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-700 transition-colors hover:bg-gray-100 active:scale-95"
              aria-label="Diminuer"
            >
              <Minus className="h-5 w-5" />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={nombre}
              onChange={(e) => handleInput(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-center text-lg font-semibold tabular-nums text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
              aria-label="Nombre d&apos;entrées"
            />
            <button
              type="button"
              onClick={() => bump(1)}
              className="flex h-11 min-h-[44px] w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-700 transition-colors hover:bg-gray-100 active:scale-95"
              aria-label="Augmenter"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Enregistrer
              </>
            )}
          </button>

          {savedOk && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              Enregistré
            </p>
          )}
          {error && (
            <p className="mt-2 text-center text-xs text-red-600">{error}</p>
          )}
        </>
      )}
    </section>
  );
}
