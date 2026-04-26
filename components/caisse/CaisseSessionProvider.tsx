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

export type SessionCaisse = {
  id: string;
  heure_ouverture: string;
  heure_fermeture: string | null;
  fond_de_caisse: number;
  total_ventes_especes: number;
  total_declare_especes: number | null;
  ecart: number | null;
  statut: "ouverte" | "fermee";
};

type Ctx = {
  session: SessionCaisse | null;
  loading: boolean;
  /** Caisse ouverte : vrai si une session `ouverte` existe */
  isCaisseOuverte: boolean;
  /** Fond (saisie) pour l&apos;ouverture */
  fondSaisi: string;
  setFondSaisi: (v: string) => void;
  openCaisse: () => Promise<void>;
  opening: boolean;
  openClotureModal: () => void;
  clotureModalOpen: boolean;
  setClotureModalOpen: (v: boolean) => void;
  /** Afficher l’écran de verrou sur la page caisse (nouvelle vente) */
  isPosLocked: boolean;
  /** Chargement de la session sur la page nouvelle vente (évite d’afficher le catalogue) */
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

function parseFondDeCaisse(raw: string): number {
  const s = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return NaN;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export function CaisseSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionCaisse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fondSaisi, setFondSaisi] = useState("");
  const [openingError, setOpeningError] = useState<string | null>(null);
  const [clotureModalOpen, setClotureModalOpen] = useState(false);
  const [clotureLoading, setClotureLoading] = useState(false);
  const [opening, setOpening] = useState(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sessions_caisse")
        .select(
          "id, heure_ouverture, heure_fermeture, fond_de_caisse, total_ventes_especes, total_declare_especes, ecart, statut"
        )
        .eq("statut", "ouverte")
        .order("heure_ouverture", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(error);
        setSession(null);
        return;
      }
      setSession((data as SessionCaisse) ?? null);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const isCaisseOuverte = session?.statut === "ouverte";
  const isPosCaisseLoading =
    isVendeuseCaissePath(pathname) && loading;
  const isPosLocked =
    isVendeuseCaissePath(pathname) && !loading && !isCaisseOuverte;

  const openCaisse = useCallback(async () => {
    const f = parseFondDeCaisse(fondSaisi);
    if (f < 0 || Number.isNaN(f)) {
      setOpeningError("Montant de fond invalide.");
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
          fond_de_caisse: f,
          statut: "ouverte",
        })
        .select(
          "id, heure_ouverture, heure_fermeture, fond_de_caisse, total_ventes_especes, total_declare_especes, ecart, statut"
        )
        .single();

      if (error) {
        setOpeningError(
          error.message ?? "Impossible d’ouvrir la caisse. Réessayez."
        );
        return;
      }
      setSession(data as SessionCaisse);
      setFondSaisi("");
      toast.success("Caisse ouverte.");
      router.refresh();
    } catch (e) {
      setOpeningError(
        e instanceof Error ? e.message : "Erreur inattendue à l’ouverture."
      );
    } finally {
      setOpening(false);
    }
  }, [fondSaisi, supabase, router]);

  const openClotureModal = useCallback(() => {
    if (!session) return;
    setClotureModalOpen(true);
  }, [session]);

  const handleClotureSubmit = useCallback(
    async (totalDeclare: number) => {
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
        const fond = Math.round(session.fond_de_caisse * 100) / 100;
        const totalDeclareRounded = Math.round(totalDeclare * 100) / 100;
        const montantTheorique = Math.round((fond + totalEspeces) * 100) / 100;
        const ecart = Math.round((totalDeclareRounded - montantTheorique) * 100) / 100;
        const now = new Date().toISOString();

        const { data: updated, error: upErr } = await supabase
          .from("sessions_caisse")
          .update({
            heure_fermeture: now,
            total_ventes_especes: totalEspeces,
            total_declare_especes: totalDeclareRounded,
            ecart,
            statut: "fermee",
          })
          .eq("id", session.id)
          .eq("statut", "ouverte")
          .select("id")
          .maybeSingle();

        if (upErr) {
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
        toast.success(
          `Caisse fermée avec succès. Écart : ${formatEcartEur(ecart)}`
        );
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
    [session, supabase, router, pathname]
  );

  const value: Ctx = {
    session,
    loading,
    isCaisseOuverte: !!isCaisseOuverte,
    fondSaisi,
    setFondSaisi,
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
          fond={session.fond_de_caisse}
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
