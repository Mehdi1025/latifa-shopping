"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { sommeEspecesVentes } from "@/lib/caisse/montant-especes-vente";
import ComptageCaisseModal from "./ComptageCaisseModal";
import type { ClotureCaissePayload } from "./ComptageCaisseModal";

const FOND_PREMIER_JOUR_EUR = 100;

const SESSION_SELECT =
  "id, heure_ouverture, heure_fermeture, fond_initial, ventes_especes, total_declare, ecart, statut, details_comptage" as const;

export type SessionCaisse = {
  id: string;
  heure_ouverture: string;
  heure_fermeture: string | null;
  fond_initial: number;
  ventes_especes: number;
  total_declare: number | null;
  ecart: number | null;
  statut: "ouverte" | "fermee";
  details_comptage: Record<string, unknown> | null;
  /** Présents après migration `sessions_caisse` v2 prélev. + sur sessions fermées */
  fond_laisse?: number | null;
  montant_preleve?: number | null;
};

type Ctx = {
  session: SessionCaisse | null;
  loading: boolean;
  isCaisseOuverte: boolean;
  /** Fond qui sera utilisé à l’ouverture (fond laissé la veille ou 100 €) */
  fondHeredite: number;
  /** Faux si 100 € par défaut (aucune clôture veille avec fond identifiable) */
  aHerediteDernierComptage: boolean;
  openCaisse: () => Promise<void>;
  opening: boolean;
  openClotureModal: () => void;
  clotureModalOpen: boolean;
  setClotureModalOpen: (v: boolean) => void;
  isPosLocked: boolean;
  isPosCaisseLoading: boolean;
  openingError: string | null;
};

const CaisseSessionContext = createContext<Ctx | null>(null);

function isVendeuseCaissePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/vendeuse" || pathname === "/vendeuse/";
}

function formatEcartEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export function CaisseSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionCaisse | null>(null);
  const [fondHeredite, setFondHeredite] = useState(FOND_PREMIER_JOUR_EUR);
  const [aHerediteDernierComptage, setAHerediteDernierComptage] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const [openingError, setOpeningError] = useState<string | null>(null);
  const [clotureModalOpen, setClotureModalOpen] = useState(false);
  const [clotureLoading, setClotureLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [clotureMontantAttendu, setClotureMontantAttendu] = useState<
    number | null
  >(null);
  const [clotureMontantAttenduLoading, setClotureMontantAttenduLoading] =
    useState(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const loadCaisseState = useCallback(
    async (opts?: { showLoader?: boolean }) => {
      const showLoader = opts?.showLoader !== false;
      if (showLoader) setLoading(true);
      try {
        const { data: open, error: e1 } = await supabase
          .from("sessions_caisse")
          .select(SESSION_SELECT)
          .eq("statut", "ouverte")
          .order("heure_ouverture", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (e1) {
          console.error(e1);
          setSession(null);
          setFondHeredite(FOND_PREMIER_JOUR_EUR);
          setAHerediteDernierComptage(false);
          return;
        }

        if (open) {
          setSession(open as SessionCaisse);
          return;
        }

        setSession(null);
        const { data: last, error: e2 } = await supabase
          .from("sessions_caisse")
          .select("*")
          .eq("statut", "fermee")
          .order("heure_fermeture", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (e2) {
          console.error(e2);
          setFondHeredite(FOND_PREMIER_JOUR_EUR);
          setAHerediteDernierComptage(false);
          return;
        }

        const row = last as {
          fond_laisse: number | null;
          total_declare: number | null;
        } | null;
        const depuisFondLaisse = row?.fond_laisse;
        const fallbackTotalDeclare = row?.total_declare;
        const valeur =
          depuisFondLaisse != null && Number.isFinite(Number(depuisFondLaisse))
            ? Math.round(Number(depuisFondLaisse) * 100) / 100
            : fallbackTotalDeclare != null &&
                Number.isFinite(Number(fallbackTotalDeclare))
              ? Math.round(Number(fallbackTotalDeclare) * 100) / 100
              : null;
        if (valeur != null) {
          setFondHeredite(valeur);
          setAHerediteDernierComptage(true);
        } else {
          setFondHeredite(FOND_PREMIER_JOUR_EUR);
          setAHerediteDernierComptage(false);
        }
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    void loadCaisseState();
  }, [loadCaisseState]);

  useEffect(() => {
    if (!clotureModalOpen || !session) {
      setClotureMontantAttendu(null);
      setClotureMontantAttenduLoading(false);
      return;
    }

    let cancelled = false;
    setClotureMontantAttenduLoading(true);
    setClotureMontantAttendu(null);

    void (async () => {
      const { data: ventes, error: venteErr } = await supabase
        .from("ventes")
        .select("total, methode_paiement, montant_especes, created_at")
        .gte("created_at", session.heure_ouverture)
        .order("created_at", { ascending: true })
        .limit(5000);

      if (cancelled) return;
      setClotureMontantAttenduLoading(false);
      if (venteErr) {
        console.error(venteErr);
        setClotureMontantAttendu(null);
        return;
      }

      const list = (ventes ?? []) as Array<{
        total: number;
        methode_paiement: string | null;
        montant_especes: number | null;
      }>;
      const totalEspeces = sommeEspecesVentes(list);
      const fond = Math.round(session.fond_initial * 100) / 100;
      const montantAttendu =
        Math.round((fond + totalEspeces) * 100) / 100;
      if (!cancelled) setClotureMontantAttendu(montantAttendu);
    })();

    return () => {
      cancelled = true;
    };
  }, [clotureModalOpen, session, supabase]);

  const isCaisseOuverte = session?.statut === "ouverte";
  const isPosCaisseLoading = isVendeuseCaissePath(pathname) && loading;
  const isPosLocked =
    isVendeuseCaissePath(pathname) && !loading && !isCaisseOuverte;

  const openCaisse = useCallback(async () => {
    const f = Math.round(fondHeredite * 100) / 100;
    if (f < 0 || !Number.isFinite(f)) {
      setOpeningError("Fond initial invalide.");
      return;
    }
    setOpening(true);
    setOpeningError(null);
    try {
      const heure = new Date().toISOString();
      const { data, error } = await supabase
        .from("sessions_caisse")
        .insert({
          heure_ouverture: heure,
          fond_initial: f,
          statut: "ouverte",
        })
        .select(SESSION_SELECT)
        .single();

      if (error) {
        setOpeningError(
          error.message ?? "Impossible d’ouvrir la caisse. Réessayez."
        );
        return;
      }
      setSession(data as SessionCaisse);
      toast.success("Caisse ouverte.");
      router.refresh();
    } catch (e) {
      setOpeningError(
        e instanceof Error ? e.message : "Erreur inattendue à l’ouverture."
      );
    } finally {
      setOpening(false);
    }
  }, [fondHeredite, supabase, router]);

  const openClotureModal = useCallback(() => {
    if (!session) return;
    setClotureModalOpen(true);
  }, [session]);

  const handleClotureSubmit = useCallback(
    async (payload: ClotureCaissePayload) => {
      if (!session) return;
      setClotureLoading(true);
      try {
        const { data: ventes, error: venteErr } = await supabase
          .from("ventes")
          .select("total, methode_paiement, montant_especes, created_at")
          .gte("created_at", session.heure_ouverture)
          .order("created_at", { ascending: true })
          .limit(5000);

        if (venteErr) {
          toast.error(venteErr.message ?? "Impossible de lire les ventes.");
          return;
        }

        const list = (ventes ?? []) as Array<{
          total: number;
          methode_paiement: string | null;
          montant_especes: number | null;
        }>;

        const totalEspeces = sommeEspecesVentes(list);
        const fondSession = Math.round(session.fond_initial * 100) / 100;
        const totalDeclareRounded =
          Math.round(payload.totalDeclareEtape1 * 100) / 100;
        const fondLaisseRounded =
          Math.round(payload.fondLaisseEtape2 * 100) / 100;
        const montantAttendu =
          Math.round((fondSession + totalEspeces) * 100) / 100;
        const ecart =
          Math.round((totalDeclareRounded - montantAttendu) * 100) / 100;

        if (fondLaisseRounded > totalDeclareRounded + 0.005) {
          toast.error(
            "Le fond laissé ne peut pas dépasser le total compté dans le tiroir."
          );
          return;
        }

        const montantPreleveRounded =
          Math.round((totalDeclareRounded - fondLaisseRounded) * 100) / 100;

        if (montantPreleveRounded < 0) {
          toast.error("Montant de prélèvement incohérent (négatif).");
          return;
        }

        const now = new Date().toISOString();

        const { data: updated, error: upErr } = await supabase
          .from("sessions_caisse")
          .update({
            heure_fermeture: now,
            ventes_especes: totalEspeces,
            total_declare: totalDeclareRounded,
            ecart,
            statut: "fermee",
            fond_laisse: fondLaisseRounded,
            montant_preleve: montantPreleveRounded,
            details_comptage: {
              comptage_total_tiroir: payload.detailsComptageTotalTiroir,
              comptage_fond_laisse_tiroir: payload.detailsComptageFondLaisse,
            },
          })
          .eq("id", session.id)
          .eq("statut", "ouverte")
          .select("id")
          .maybeSingle();

        if (upErr) {
          if (
            typeof upErr.message === "string" &&
            /fond_laisse|montant_preleve|does not exist|schema cache/i.test(
              upErr.message
            )
          ) {
            toast.error(
              "Mise à jour base requise : exécutez le SQL de la migration supabase/migrations/20260502140000_sessions_caisse_fond_laisse_preleve.sql dans le SQL Editor Supabase (ou supabase db push)."
            );
            return;
          }
          toast.error(upErr.message ?? "Échec de la clôture.");
          return;
        }
        if (!updated) {
          toast.error("Cette caisse est déjà fermée ou la session a expiré.");
          setClotureModalOpen(false);
          setSession(null);
          return;
        }

        setClotureModalOpen(false);
        setSession(null);
        setFondHeredite(fondLaisseRounded);
        toast.success(
          `Caisse clôturée. Écart : ${formatEcartEur(ecart)} • Enveloppe : ${formatEcartEur(montantPreleveRounded)} • Fond demain : ${formatEcartEur(fondLaisseRounded)}`
        );
        void loadCaisseState({ showLoader: false });
        if (isVendeuseCaissePath(pathname)) {
          router.push("/vendeuse");
        } else {
          router.refresh();
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Erreur pendant la clôture."
        );
      } finally {
        setClotureLoading(false);
      }
    },
    [session, supabase, loadCaisseState, router, pathname]
  );

  const value: Ctx = {
    session,
    loading,
    isCaisseOuverte: !!isCaisseOuverte,
    fondHeredite,
    aHerediteDernierComptage,
    openCaisse,
    opening,
    openClotureModal,
    clotureModalOpen,
    setClotureModalOpen,
    isPosLocked,
    isPosCaisseLoading,
    openingError,
  };

  return (
    <CaisseSessionContext.Provider value={value}>
      {children}
      {session && (
        <ComptageCaisseModal
          open={clotureModalOpen}
          onOpenChange={setClotureModalOpen}
          onSubmit={handleClotureSubmit}
          loading={clotureLoading}
          fondInitial={session.fond_initial}
          montantAttenduCaisse={clotureMontantAttendu}
          montantAttenduLoading={clotureMontantAttenduLoading}
        />
      )}
    </CaisseSessionContext.Provider>
  );
}

export function useCaisseSession() {
  const c = useContext(CaisseSessionContext);
  if (!c) {
    throw new Error("useCaisseSession must be used within CaisseSessionProvider");
  }
  return c;
}
