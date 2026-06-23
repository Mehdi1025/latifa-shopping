"use client";

import { useCallback, useEffect, useState } from "react";
import { Landmark, Loader2, Target } from "lucide-react";
import { toast } from "sonner";

import {
  DEFAULT_CHARGES_FIXES_MENSUELLES,
  DEFAULT_OBJECTIF_CA_MENSUEL,
  DEFAULT_OBJECTIF_COMMANDES_MENSUEL,
  type ShopSettingsBusiness,
} from "@/lib/shop-settings";

export default function ShopSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chargesFixes, setChargesFixes] = useState(
    String(DEFAULT_CHARGES_FIXES_MENSUELLES)
  );
  const [objectifCa, setObjectifCa] = useState(String(DEFAULT_OBJECTIF_CA_MENSUEL));
  const [objectifCommandes, setObjectifCommandes] = useState(
    String(DEFAULT_OBJECTIF_COMMANDES_MENSUEL)
  );

  const applySettings = useCallback((s: ShopSettingsBusiness) => {
    setChargesFixes(String(s.charges_fixes_mensuelles));
    setObjectifCa(String(s.objectif_ca_mensuel));
    setObjectifCommandes(String(s.objectif_commandes_mensuel));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shop-settings");
      const payload = (await res.json()) as {
        settings?: ShopSettingsBusiness;
        error?: string;
      };
      if (payload.settings) {
        applySettings(payload.settings);
      }
    } catch {
      toast.error("Impossible de charger les paramètres.");
    } finally {
      setLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const charges = Number.parseFloat(chargesFixes.replace(",", "."));
    const ca = Number.parseFloat(objectifCa.replace(",", "."));
    const cmd = Number.parseInt(objectifCommandes, 10);

    if (!Number.isFinite(charges) || charges < 0) {
      toast.error("Charges fixes invalides.");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(ca) || ca < 0) {
      toast.error("Objectif CA invalide.");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(cmd) || cmd < 0) {
      toast.error("Objectif commandes invalide.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/shop-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          charges_fixes_mensuelles: Math.round(charges * 100) / 100,
          objectif_ca_mensuel: Math.round(ca * 100) / 100,
          objectif_commandes_mensuel: cmd,
        }),
      });
      const payload = (await res.json()) as {
        settings?: ShopSettingsBusiness;
        error?: string;
      };

      if (!res.ok) {
        toast.error(payload.error ?? "Enregistrement impossible.");
        return;
      }

      if (payload.settings) applySettings(payload.settings);
      toast.success("Paramètres enregistrés.");
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-10 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Chargement…
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-8">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Landmark className="h-5 w-5 text-slate-500" />
          Charges fixes
        </h2>
        <p className="mb-5 text-sm text-slate-500">
          Utilisées pour le runway trésorerie et le budget réassort sur la page KPI.
        </p>
        <div>
          <label
            htmlFor="charges-fixes"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Charges fixes mensuelles (€)
          </label>
          <input
            id="charges-fixes"
            type="number"
            min={0}
            step={50}
            required
            value={chargesFixes}
            onChange={(e) => setChargesFixes(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Loyer, électricité, salaires de base, etc.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Target className="h-5 w-5 text-slate-500" />
          Objectifs mensuels
        </h2>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="objectif-ca"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Objectif CA (€)
            </label>
            <input
              id="objectif-ca"
              type="number"
              min={0}
              step={100}
              required
              value={objectifCa}
              onChange={(e) => setObjectifCa(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label
              htmlFor="objectif-commandes"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Objectif commandes
            </label>
            <input
              id="objectif-commandes"
              type="number"
              min={0}
              step={1}
              required
              value={objectifCommandes}
              onChange={(e) => setObjectifCommandes(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-indigo-600 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Enregistrement…
          </>
        ) : (
          "Sauvegarder"
        )}
      </button>
    </form>
  );
}
