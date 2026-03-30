"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { MYSTERY_VAULT_PRODUCT_ID } from "@/lib/constants/mystery-vault";
import { localDateISO } from "@/hooks/useObjectifDuJour";

export type AlertSeverity = "danger" | "warning";

export type AlertItem = {
  id: string;
  severity: AlertSeverity;
  /** Texte affiché en gras (problème / action attendue). */
  message: string;
  actionLabel: string;
  href: string;
};

export type UseAlertsOptions = {
  /** Si false : uniquement les alertes stock (surface vendeuse). Défaut true (admin). */
  includeTasks?: boolean;
  /** Règles flux / conversion (admin uniquement). Défaut false. */
  includeAdminIntelligence?: boolean;
  /** Cible du bouton sur les alertes stock (admin → fiches produits, vendeuse → réception). */
  stockLink?: { href: string; actionLabel: string };
};

const STOCK_THRESHOLD = 5;

function isTaskOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

function isTaskOpen(statut: string): boolean {
  const s = statut.trim().toLowerCase();
  return s !== "termine" && s !== "terminé";
}

const DEFAULT_STOCK_LINK = { href: "/produits", actionLabel: "Voir produit" };

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useAlerts(options?: UseAlertsOptions) {
  const includeTasks = options?.includeTasks ?? true;
  const includeAdminIntelligence = options?.includeAdminIntelligence ?? false;
  const stockLink = options?.stockLink ?? DEFAULT_STOCK_LINK;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nowIso = new Date().toISOString();
      const fromDay = startOfTodayISO();
      const jour = localDateISO();

      const [produitsRes, tachesRes, trafficRes, ventesCountRes] = await Promise.all([
        supabase
          .from("produits")
          .select("id, nom, stock")
          .lte("stock", STOCK_THRESHOLD)
          .order("stock", { ascending: true }),
        includeTasks
          ? supabase
              .from("taches")
              .select("id, titre, deadline, statut")
              .neq("statut", "termine")
              .not("deadline", "is", null)
              .lt("deadline", nowIso)
          : Promise.resolve({ data: null, error: null }),
        includeAdminIntelligence
          ? supabase
              .from("daily_traffic")
              .select("nombre_entrees")
              .eq("jour", jour)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        includeAdminIntelligence
          ? supabase
              .from("ventes")
              .select("id", { count: "exact", head: true })
              .gte("created_at", fromDay)
          : Promise.resolve({ count: null, error: null }),
      ]);

      if (produitsRes.error) {
        setError(produitsRes.error.message);
        setAlerts([]);
        return;
      }

      if (includeTasks && tachesRes && "error" in tachesRes && tachesRes.error) {
        setError(tachesRes.error.message);
        setAlerts([]);
        return;
      }

      const intelTrafficOk =
        !includeAdminIntelligence ||
        !(trafficRes && "error" in trafficRes && trafficRes.error);
      const intelVentesOk =
        !includeAdminIntelligence ||
        !(ventesCountRes && "error" in ventesCountRes && ventesCountRes.error);

      const stockRows = (produitsRes.data ?? []) as {
        id: string;
        nom: string;
        stock: number;
      }[];

      const stockAlerts: AlertItem[] = stockRows
        .filter((p) => p.id !== MYSTERY_VAULT_PRODUCT_ID)
        .map((p) => ({
          id: `stock-${p.id}`,
          severity: "danger" as const,
          message: `Stock critique : ${p.nom} (Reste ${p.stock})`,
          actionLabel: stockLink.actionLabel,
          href: stockLink.href,
        }));

      let taskAlerts: AlertItem[] = [];
      if (includeTasks && tachesRes && "data" in tachesRes && tachesRes.data) {
        const rows = tachesRes.data as {
          id: string;
          titre: string;
          deadline: string | null;
          statut: string;
        }[];
        taskAlerts = rows
          .filter((t) => isTaskOpen(t.statut) && isTaskOverdue(t.deadline))
          .map((t) => ({
            id: `task-${t.id}`,
            severity: "warning" as const,
            message: `Tâche en retard : « ${t.titre} »`,
            actionLabel: "Ouvrir",
            href: `/organisation`,
          }));
      }

      const intelligenceAlerts: AlertItem[] = [];
      if (
        includeAdminIntelligence &&
        intelTrafficOk &&
        intelVentesOk
      ) {
        const nombreEntrees =
          (trafficRes && "data" in trafficRes
            ? (trafficRes.data as { nombre_entrees?: number } | null)?.nombre_entrees
            : null) ?? null;
        const nbVentesJour =
          (ventesCountRes && "count" in ventesCountRes
            ? ventesCountRes.count
            : null) ?? 0;

        const entreesNum =
          typeof nombreEntrees === "number" && !Number.isNaN(nombreEntrees)
            ? nombreEntrees
            : 0;
        const hasFluxSaisi = entreesNum > 0;

        const hour = new Date().getHours();
        if (hour > 16 && !hasFluxSaisi) {
          intelligenceAlerts.push({
            id: "intel-flux-manquant",
            severity: "warning",
            message:
              "Saisie du flux client manquante pour aujourd'hui.",
            actionLabel: "Saisir",
            href: "/vendeuse",
          });
        }

        const tauxConversion =
          entreesNum > 0 ? (nbVentesJour / entreesNum) * 100 : null;
        if (
          entreesNum > 10 &&
          tauxConversion !== null &&
          tauxConversion < 15
        ) {
          intelligenceAlerts.push({
            id: "intel-conversion-faible",
            severity: "danger",
            message:
              "Taux de conversion faible aujourd'hui. Action : Vérifier la surface de vente.",
            actionLabel: "Caisse",
            href: "/vendeuse",
          });
        }
      }

      const merged = [...stockAlerts, ...taskAlerts, ...intelligenceAlerts].sort(
        (a, b) => {
          if (a.severity === b.severity) return 0;
          return a.severity === "danger" ? -1 : 1;
        }
      );

      setAlerts(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors du chargement des alertes.");
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [
    supabase,
    includeTasks,
    includeAdminIntelligence,
    stockLink.href,
    stockLink.actionLabel,
  ]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, loading, error, refetch: fetchAlerts };
}
