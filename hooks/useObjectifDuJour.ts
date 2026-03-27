"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

export const DEFAULT_OBJECTIF_MONTANT = 1000;

/** Date locale YYYY-MM-DD (alignée sur le fuseau du navigateur). */
export function localDateISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type ObjectifDuJourRow = {
  montantCible: number;
  noteDuJour: string | null;
  tauxConversion: number | null;
  loading: boolean;
};

/**
 * Objectif et note du jour pour la date courante, avec rafraîchissement temps réel
 * (Supabase Realtime) + secours par polling si la réplication n'est pas activée.
 */
export function useObjectifDuJour(): ObjectifDuJourRow & { refetch: () => Promise<void> } {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [montantCible, setMontantCible] = useState(DEFAULT_OBJECTIF_MONTANT);
  const [noteDuJour, setNoteDuJour] = useState<string | null>(null);
  const [tauxConversion, setTauxConversion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchToday = useCallback(async () => {
    const jour = localDateISO();
    const { data, error } = await supabase
      .from("objectifs_journaliers")
      .select("montant_cible, note_du_jour, taux_conversion")
      .eq("jour", jour)
      .maybeSingle();

    if (error) {
      setMontantCible(DEFAULT_OBJECTIF_MONTANT);
      setNoteDuJour(null);
      setTauxConversion(null);
      setLoading(false);
      return;
    }

    if (!data) {
      setMontantCible(DEFAULT_OBJECTIF_MONTANT);
      setNoteDuJour(null);
      setTauxConversion(null);
      setLoading(false);
      return;
    }

    const row = data as {
      montant_cible: number | null;
      note_du_jour: string | null;
      taux_conversion: number | null;
    };
    setMontantCible(
      row.montant_cible != null && !Number.isNaN(Number(row.montant_cible))
        ? Number(row.montant_cible)
        : DEFAULT_OBJECTIF_MONTANT
    );
    setNoteDuJour(row.note_du_jour?.trim() ? row.note_du_jour : null);
    setTauxConversion(
      row.taux_conversion != null && !Number.isNaN(Number(row.taux_conversion))
        ? Number(row.taux_conversion)
        : null
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void fetchToday();
  }, [fetchToday]);

  useEffect(() => {
    const channel = supabase
      .channel("public:objectifs_journaliers")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "objectifs_journaliers",
        },
        () => {
          void fetchToday();
        }
      )
      .subscribe();

    const poll = window.setInterval(() => {
      void fetchToday();
    }, 15000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [supabase, fetchToday]);

  return {
    montantCible,
    noteDuJour,
    tauxConversion,
    loading,
    refetch: fetchToday,
  };
}
