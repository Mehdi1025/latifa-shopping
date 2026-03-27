"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Radar, X } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import type { ClientCrmRow } from "@/types/crm";

const JOURS_MIN_DEPUIS_VENTE = 30;
const MAX_MISSIONS = 5;

type VenteRow = {
  id: string;
  client_id: string | null;
  total: number | null;
  created_at: string;
};

export type VipMission = {
  clientId: string;
  nom: string;
  telephone: string;
  joursDepuis: number;
  dernierProduitNom: string;
  /** Affichage : VIP ou Endormi (colonnes segment_rfm) */
  segmentAffiche: "VIP" | "Endormi";
  ltv: number;
  actionText: string;
};

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (86400000));
}

function firstName(nom: string): string {
  return nom.trim().split(/\s+/)[0] ?? nom;
}

function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 2) return d;
  const parts = [d.slice(0, 2)];
  for (let i = 2; i < d.length; i += 2) {
    parts.push(d.slice(i, i + 2));
  }
  return parts.join(" ");
}

/** segment_rfm en base : VIP | Endormi (casse tolérée) */
function matchesRadarSegment(segment_rfm: string | null | undefined): boolean {
  const s = (segment_rfm ?? "").trim().toLowerCase();
  return s === "vip" || s === "endormi";
}

function segmentAfficheFromDb(segment_rfm: string | null | undefined): "VIP" | "Endormi" {
  const s = (segment_rfm ?? "").trim().toLowerCase();
  if (s === "vip") return "VIP";
  return "Endormi";
}

function phoneToWaDigits(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("33") && d.length >= 11) return d;
  if (d.startsWith("0") && d.length >= 10) return `33${d.slice(1)}`;
  if (d.length >= 10) return d;
  return null;
}

function buildWhatsAppText(nomComplet: string): string {
  const prenom = firstName(nomComplet);
  return `Bonjour ${prenom} ! C'est l'équipe Latifa Shop. En regardant nos nouveautés, j'ai tout de suite pensé à vous suite à votre dernière visite. Nous avons des pièces exclusives qui vous iraient à merveille. Passez nous voir en boutique cette semaine ! ✨`;
}

function buildWaUrl(phoneDigits: string, nom: string): string {
  const intl = phoneToWaDigits(phoneDigits);
  if (!intl) return "#";
  const text = buildWhatsAppText(nom);
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

function missionActionSuggestion(produitNom: string, categorie: string | null): string {
  const p = produitNom.toLowerCase();
  if (p.includes("abaya") || p.includes("robe")) {
    return "Proposez des voiles ou accessoires assortis aux nouveautés — parfait pour compléter son dernier look.";
  }
  if (categorie?.toLowerCase().includes("access")) {
    return "Mettez en avant les tenues qui subliment ces pièces — nouvelle collection en boutique.";
  }
  return "Faites découvrir les nouveautés exclusives qui prolongent son style.";
}

export default function VipRadar() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [missions, setMissions] = useState<VipMission[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [contactedIds, setContactedIds] = useState<Set<string>>(new Set());

  const visibleMissions = useMemo(
    () => missions.filter((m) => !contactedIds.has(m.clientId)),
    [missions, contactedIds]
  );

  const fetchMissions = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data: clientsData, error: cErr } = await supabase
        .from("clients")
        .select("id, nom, telephone, segment_rfm, total_depense");
      if (cErr) throw cErr;

      const clients = (clientsData ?? []) as ClientCrmRow[];
      const cibles = clients.filter(
        (c) =>
          c.telephone &&
          c.telephone.replace(/\D/g, "").length >= 8 &&
          matchesRadarSegment(c.segment_rfm)
      );

      if (cibles.length === 0) {
        setMissions([]);
        setLoading(false);
        return;
      }

      const ids = cibles.map((c) => c.id);

      const { data: ventesData, error: vErr } = await supabase
        .from("ventes")
        .select("id, client_id, total, created_at")
        .in("client_id", ids);
      if (vErr) throw vErr;

      const ventes = (ventesData ?? []) as VenteRow[];
      const ventesParClient = new Map<string, VenteRow[]>();
      for (const v of ventes) {
        if (!v.client_id) continue;
        const list = ventesParClient.get(v.client_id) ?? [];
        list.push(v);
        ventesParClient.set(v.client_id, list);
      }

      const now = new Date();

      type Candidat = {
        client: ClientCrmRow;
        lastVente: VenteRow;
        jours: number;
        ltv: number;
      };

      const candidats: Candidat[] = [];

      for (const cl of cibles) {
        const list = ventesParClient.get(cl.id);
        if (!list?.length) continue;

        const sorted = [...list].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const last = sorted[0];
        const jours = daysBetween(new Date(last.created_at), now);
        if (jours <= JOURS_MIN_DEPUIS_VENTE) continue;

        const ltv = list.reduce((s, v) => s + (v.total ?? 0), 0);
        candidats.push({ client: cl, lastVente: last, jours, ltv });
      }

      candidats.sort((a, b) => {
        const ta = a.client.total_depense ?? a.ltv;
        const tb = b.client.total_depense ?? b.ltv;
        return tb - ta;
      });

      const top = candidats.slice(0, MAX_MISSIONS);
      const lastVenteIds = top.map((t) => t.lastVente.id);
      const produitByVente = new Map<
        string,
        { nom: string; categorie: string | null }
      >();

      if (lastVenteIds.length > 0) {
        const { data: items } = await supabase
          .from("ventes_items")
          .select("vente_id, produit_id, quantite")
          .in("vente_id", lastVenteIds);

        const produitIds = [
          ...new Set(
            (items ?? []).map((i: { produit_id: string }) => i.produit_id)
          ),
        ];
        const { data: produits } = await supabase
          .from("produits")
          .select("id, nom, categorie")
          .in("id", produitIds);

        const prodMap = Object.fromEntries(
          (
            (produits ?? []) as {
              id: string;
              nom: string;
              categorie: string | null;
            }[]
          ).map((p) => [p.id, p])
        );

        for (const it of items ?? []) {
          const row = it as {
            vente_id: string;
            produit_id: string;
            quantite: number;
          };
          if (!produitByVente.has(row.vente_id)) {
            const pr = prodMap[row.produit_id];
            if (pr) {
              produitByVente.set(row.vente_id, {
                nom: pr.nom,
                categorie: pr.categorie,
              });
            }
          }
        }
      }

      const built: VipMission[] = [];
      for (const c of top) {
        const tel = c.client.telephone ?? "";
        const prod =
          produitByVente.get(c.lastVente.id) ?? {
            nom: "article",
            categorie: null,
          };
        built.push({
          clientId: c.client.id,
          nom: c.client.nom,
          telephone: tel,
          joursDepuis: c.jours,
          dernierProduitNom: prod.nom,
          segmentAffiche: segmentAfficheFromDb(c.client.segment_rfm),
          ltv: c.ltv,
          actionText: missionActionSuggestion(prod.nom, prod.categorie),
        });
      }

      setMissions(built);
    } catch (e) {
      setFetchError(
        e instanceof Error ? e.message : "Impossible de charger le radar."
      );
      setMissions([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    setContactedIds(new Set());
    fetchMissions();
  }, [open, fetchMissions]);

  const handleContact = (m: VipMission) => {
    const url = buildWaUrl(m.telephone, m.nom);
    if (url === "#") {
      toast.error("Numéro de téléphone invalide pour WhatsApp.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success("✅ Cible contactée !");
    setContactedIds((prev) => new Set([...prev, m.clientId]));
  };

  return (
    <>
      <div className="mb-5 shrink-0 px-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 py-4 text-left shadow-[0_12px_40px_-12px_rgba(15,23,42,0.45)] transition-all duration-300 hover:shadow-[0_16px_48px_-12px_rgba(15,23,42,0.55)] active:scale-[0.99] md:py-5"
        >
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-emerald-500/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          <Radar className="relative h-7 w-7 shrink-0 text-amber-300/90" strokeWidth={1.5} />
          <span className="relative text-center text-base font-semibold tracking-tight text-white md:text-lg">
            📡 Lancer le Radar VIP (Heures Creuses)
          </span>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Radar VIP"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-[220] flex flex-col bg-zinc-950/97 backdrop-blur-md"
          >
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full border border-emerald-400/25"
                  style={{
                    width: "min(120vw, 900px)",
                    height: "min(120vw, 900px)",
                  }}
                  initial={{ scale: 0.4, opacity: 0.45 }}
                  animate={{
                    scale: [1, 1.5, 2],
                    opacity: [0.5, 0.25, 0],
                  }}
                  transition={{
                    duration: 3.2,
                    repeat: Infinity,
                    delay: i * 1.05,
                    ease: "easeOut",
                  }}
                />
              ))}
              <motion.div
                className="absolute h-[140%] w-6 skew-x-12 bg-gradient-to-b from-transparent via-emerald-400/15 to-transparent"
                animate={{ x: ["-50vw", "50vw"] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />
            </div>

            <div className="relative z-10 flex max-h-full flex-1 flex-col overflow-hidden">
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-4 md:px-8">
                <div>
                  <h2 className="font-serif text-xl font-medium tracking-wide text-white md:text-2xl">
                    Radar VIP
                  </h2>
                  <p className="mt-1 text-xs text-white/45 md:text-sm">
                    Segments <span className="text-white/70">VIP</span> ou{" "}
                    <span className="text-white/70">Endormi</span> — dernière
                    vente il y a plus de {JOURS_MIN_DEPUIS_VENTE} jours
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
                {loading && (
                  <div className="flex flex-col items-center justify-center py-24">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    >
                      <Radar className="h-12 w-12 text-emerald-400/80" />
                    </motion.div>
                    <p className="mt-6 text-sm text-white/50">
                      Analyse de la base clients…
                    </p>
                  </div>
                )}

                {!loading && fetchError && (
                  <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {fetchError}
                  </p>
                )}

                {!loading && !fetchError && missions.length === 0 && (
                  <p className="text-center text-sm text-white/55">
                    Aucune cible pour le moment.
                  </p>
                )}

                {!loading &&
                  !fetchError &&
                  visibleMissions.length === 0 &&
                  missions.length > 0 && (
                    <motion.p
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center text-sm text-emerald-300/90"
                    >
                      Toutes les cibles prévues ont été contactées. Excellent
                      travail !
                    </motion.p>
                  )}

                <ul className="mx-auto flex max-w-lg flex-col gap-4 md:max-w-2xl">
                  <AnimatePresence mode="popLayout">
                    {visibleMissions.map((m) => (
                      <motion.li
                        key={m.clientId}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ x: 120, opacity: 0 }}
                        transition={{
                          type: "spring",
                          damping: 26,
                          stiffness: 320,
                        }}
                        className="list-none"
                      >
                        <article className="rounded-2xl border border-white/15 bg-white/[0.06] p-5 shadow-[0_0_40px_-12px_rgba(16,185,129,0.25)] backdrop-blur-xl ring-1 ring-emerald-500/10 md:p-6">
                          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400/80">
                                🎯 Cible
                              </p>
                              <h3 className="mt-1 font-serif text-2xl font-medium tracking-tight text-white md:text-3xl">
                                {m.nom}
                              </h3>
                              <p className="mt-2 text-sm text-white/50">
                                Tél.{" "}
                                <span className="font-medium text-white/80">
                                  {formatPhoneDisplay(m.telephone)}
                                </span>
                              </p>
                              <div className="mt-3">
                                {m.segmentAffiche === "VIP" ? (
                                  <span className="inline-flex rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-950 shadow-[0_0_20px_rgba(251,191,36,0.4)]">
                                    VIP
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full border border-orange-400/40 bg-orange-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-100">
                                    Endormi
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <p className="text-sm leading-relaxed text-white/70">
                            <span className="text-white/90">Historique : </span>
                            A acheté{" "}
                            <span className="font-medium text-white">
                              {m.dernierProduitNom}
                            </span>{" "}
                            il y a {m.joursDepuis} jour
                            {m.joursDepuis > 1 ? "s" : ""}.
                          </p>

                          <p className="mt-3 text-sm leading-relaxed text-white/55">
                            <span className="text-white/80">
                              Action suggérée :{" "}
                            </span>
                            {m.actionText}
                          </p>

                          <p className="mt-2 text-xs text-white/35">
                            LTV cumulé :{" "}
                            {new Intl.NumberFormat("fr-FR", {
                              style: "currency",
                              currency: "EUR",
                              maximumFractionDigits: 0,
                            }).format(m.ltv)}
                          </p>

                          <div className="mt-5 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleContact(m)}
                              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(37,211,102,0.55)] transition hover:brightness-110 min-[400px]:flex-initial"
                            >
                              <MessageCircle className="h-5 w-5 shrink-0" />
                              📱 Envoyer l&apos;Invitation Privée
                            </button>
                          </div>
                        </article>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
