"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { MYSTERY_VAULT_PRODUCT_ID } from "@/lib/constants/mystery-vault";

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
  /** Cible du bouton sur les alertes stock (admin → fiches produits, vendeuse → réception). */
  stockLink?: { href: string; actionLabel: string };
};

const STOCK_THRESHOLD = 5;

function isTaskOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

function isTaskOpen(statut: string): boolean {
  return statut.trim() !== "Terminé";
}

const DEFAULT_STOCK_LINK = { href: "/produits", actionLabel: "Voir produit" };

export function useAlerts(options?: UseAlertsOptions) {
  const includeTasks = options?.includeTasks ?? true;
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

      const [produitsRes, tachesRes] = await Promise.all([
        supabase
          .from("produits")
          .select("id, nom, stock")
          .lte("stock", STOCK_THRESHOLD)
          .order("stock", { ascending: true }),
        includeTasks
          ? supabase
              .from("taches")
              .select("id, titre, deadline, statut")
              .neq("statut", "Terminé")
              .not("deadline", "is", null)
              .lt("deadline", nowIso)
          : Promise.resolve({ data: null, error: null }),
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
            href: `/taches`,
          }));
      }

      const merged = [...stockAlerts, ...taskAlerts].sort((a, b) => {
        if (a.severity === b.severity) return 0;
        return a.severity === "danger" ? -1 : 1;
      });

      setAlerts(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors du chargement des alertes.");
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, includeTasks, stockLink.href, stockLink.actionLabel]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, loading, error, refetch: fetchAlerts };
}
