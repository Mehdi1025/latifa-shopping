"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { MessageCircle, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

type ClientRow = {
  id: string;
  nom: string;
  telephone: string | null;
  email: string | null;
};

type VenteRow = {
  id: string;
  client_id: string | null;
  total: number | null;
  created_at: string;
};

export type RfmClient = {
  id: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  recenceJours: number;
  frequence: number;
  montant: number;
  segment: "vip" | "regulier" | "endormi";
};

const DORMANT_DAYS = 60;
/** « Plus de 3 commandes » = au moins 4 */
const VIP_MIN_COMMANDES = 4;

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function percentile75(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.floor(0.75 * (s.length - 1));
  return s[idx] ?? s[s.length - 1] ?? 0;
}

/** Segmentation exclusive : endormis > vip > régulier */
export function segmenterRfm(
  clients: ClientRow[],
  ventesParClient: Map<string, VenteRow[]>,
  now: Date = new Date()
): { rows: RfmClient[]; seuilVipMontant: number } {
  const ltvsAll = [...ventesParClient.values()].map((vs) =>
    vs.reduce((s, v) => s + (v.total ?? 0), 0)
  );
  const ltvs4plus = [...ventesParClient.entries()]
    .filter(([, vs]) => vs.length >= VIP_MIN_COMMANDES)
    .map(([, vs]) => vs.reduce((s, v) => s + (v.total ?? 0), 0));
  const seuilVipMontant =
    ltvs4plus.length > 0
      ? percentile75(ltvs4plus)
      : ltvsAll.length > 0
        ? percentile75(ltvsAll.filter((m) => m > 0))
        : 0;

  const rows: RfmClient[] = [];

  for (const c of clients) {
    const ventes = ventesParClient.get(c.id) ?? [];
    if (ventes.length === 0) continue;

    const frequence = ventes.length;
    const montant = ventes.reduce((s, v) => s + (v.total ?? 0), 0);
    const dernier = ventes.reduce(
      (latest, v) =>
        new Date(v.created_at) > new Date(latest) ? v.created_at : latest,
      ventes[0].created_at
    );
    const recenceJours = daysBetween(new Date(dernier), now);

    const isVipProfile =
      frequence >= VIP_MIN_COMMANDES && montant >= seuilVipMontant;
    const isRegulierProfile =
      !isVipProfile &&
      frequence >= 1 &&
      (frequence <= 3 ||
        (frequence >= VIP_MIN_COMMANDES && montant < seuilVipMontant));

    let segment: RfmClient["segment"];
    if (
      recenceJours > DORMANT_DAYS &&
      (isVipProfile || isRegulierProfile)
    ) {
      segment = "endormi";
    } else if (isVipProfile) {
      segment = "vip";
    } else {
      segment = "regulier";
    }

    rows.push({
      id: c.id,
      nom: c.nom,
      telephone: c.telephone,
      email: c.email,
      recenceJours,
      frequence,
      montant,
      segment,
    });
  }

  rows.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return { rows, seuilVipMontant };
}

const SEGMENT_META = {
  vip: {
    label: "VIP",
    emoji: "🌟",
    description: "4+ commandes et panier cumulé élevé (≥ P75 des LTV).",
    border: "border-amber-400/30",
    bg: "from-amber-500/15 to-yellow-600/10",
  },
  regulier: {
    label: "Réguliers",
    emoji: "👋",
    description: "1 à 3 commandes, ou fort volume sans seuil VIP.",
    border: "border-indigo-400/25",
    bg: "from-indigo-500/12 to-slate-800/40",
  },
  endormi: {
    label: "Endormis",
    emoji: "⚠️",
    description: "Anciens VIP / Réguliers sans achat depuis 60 j.",
    border: "border-orange-400/35",
    bg: "from-orange-500/12 to-red-950/30",
  },
} as const;

const DONUT_COLORS = {
  vip: "#c9a98c",
  regulier: "#6366f1",
  endormi: "#f97316",
};

export default function CrmSegmentation() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RfmClient[]>([]);
  const [seuilNote, setSeuilNote] = useState<number>(0);
  const [modalClient, setModalClient] = useState<RfmClient | null>(null);

  const smsDraftText = useMemo(() => {
    if (!modalClient) return "";
    const prenom = modalClient.nom.trim().split(/\s+/)[0] ?? "";
    return `Bonjour ${prenom}, on pense à vous chez Latifa Shop 🌸 Profitez de -10% sur votre prochaine commande avec le code RELANCE10 (valable 7 jours). Répondez STOP pour ne plus recevoir de SMS.`;
  }, [modalClient]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: clientsData, error: e1 } = await supabase
        .from("clients")
        .select("id, nom, telephone, email")
        .order("nom");

      if (e1) {
        setError(
          e1.message.includes("relation") || e1.code === "42P01"
            ? "Table « clients » introuvable. Appliquez la migration Supabase (voir supabase/migrations)."
            : e1.message
        );
        setRows([]);
        return;
      }

      const { data: ventesData, error: e2 } = await supabase
        .from("ventes")
        .select("id, client_id, total, created_at")
        .not("client_id", "is", null);

      if (e2) {
        setError(e2.message);
        setRows([]);
        return;
      }

      const ventesParClient = new Map<string, VenteRow[]>();
      for (const v of (ventesData ?? []) as VenteRow[]) {
        if (!v.client_id) continue;
        if (!ventesParClient.has(v.client_id)) ventesParClient.set(v.client_id, []);
        ventesParClient.get(v.client_id)!.push(v);
      }

      const { rows: r, seuilVipMontant } = segmenterRfm(
        (clientsData ?? []) as ClientRow[],
        ventesParClient
      );
      setRows(r);
      setSeuilNote(seuilVipMontant);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement CRM");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const bySegment = useMemo(() => {
    const vip = rows.filter((x) => x.segment === "vip");
    const regulier = rows.filter((x) => x.segment === "regulier");
    const endormi = rows.filter((x) => x.segment === "endormi");
    return { vip, regulier, endormi };
  }, [rows]);

  const donutData = useMemo(() => {
    const total = rows.length || 1;
    return [
      {
        name: "VIP",
        value: bySegment.vip.length,
        pct: Math.round((bySegment.vip.length / total) * 1000) / 10,
        key: "vip" as const,
      },
      {
        name: "Réguliers",
        value: bySegment.regulier.length,
        pct: Math.round((bySegment.regulier.length / total) * 1000) / 10,
        key: "regulier" as const,
      },
      {
        name: "Endormis",
        value: bySegment.endormi.length,
        pct: Math.round((bySegment.endormi.length / total) * 1000) / 10,
        key: "endormi" as const,
      },
    ].filter((d) => d.value > 0);
  }, [rows.length, bySegment]);

  const formatMoney = (n: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
    }).format(n);

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-6 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.35)] md:p-8">
        <div className="pointer-events-none absolute -right-16 top-0 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
              CRM VIP &amp; Rétention
            </h2>
            <p className="mt-1 text-sm text-white/55">
              Analyse RFM — récence, fréquence, montant (LTV). Seuil VIP dynamique
              (P75 LTV) :{" "}
              <span className="font-medium text-amber-200/90">
                {formatMoney(seuilNote)}
              </span>
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        ) : error ? (
          <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-100">
            {error}
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-white/65">
            Aucun client avec ventes liées. Ajoutez des clients et renseignez{" "}
            <code className="rounded bg-white/10 px-1">ventes.client_id</code>{" "}
            pour activer l&apos;analyse RFM.
          </p>
        ) : (
          <>
            <div className="relative mx-auto mb-10 max-w-md">
              <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-white/45">
                Répartition
              </p>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={
                        donutData.length
                          ? donutData
                          : [{ name: "—", value: 1, pct: 0, key: "vip" as const }]
                      }
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={3}
                      stroke="rgba(255,255,255,0.08)"
                    >
                      {(donutData.length ? donutData : [{ key: "vip" as const }]).map(
                        (entry, i) => (
                          <Cell
                            key={`${entry.name}-${i}`}
                            fill={DONUT_COLORS[entry.key]}
                          />
                        )
                      )}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15,23,42,0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        fontSize: 12,
                      }}
                      formatter={(value: number, _n, p) => [
                        `${value} client(s) (${(p?.payload as { pct?: number })?.pct ?? 0}%)`,
                        "",
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <motion.div
              className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-5"
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.1, delayChildren: 0.05 },
                },
              }}
            >
              {(["vip", "regulier", "endormi"] as const).map((key) => {
                const meta = SEGMENT_META[key];
                const list =
                  key === "vip"
                    ? bySegment.vip
                    : key === "regulier"
                      ? bySegment.regulier
                      : bySegment.endormi;

                return (
                  <motion.div
                    key={key}
                    variants={{
                      hidden: { opacity: 0, y: 16 },
                      show: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                      },
                    }}
                    className={`flex flex-col rounded-2xl border ${meta.border} bg-gradient-to-b ${meta.bg} p-4 shadow-inner backdrop-blur-xl md:p-5`}
                  >
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-lg">{meta.emoji}</span>
                        <h3 className="mt-1 text-base font-semibold text-white">
                          {meta.label}
                        </h3>
                        <p className="mt-1 text-xs text-white/50">{meta.description}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
                          key === "vip"
                            ? "bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 text-amber-950 shadow-[0_0_20px_rgba(251,191,36,0.35)]"
                            : key === "regulier"
                              ? "border border-indigo-400/40 bg-indigo-500/25 text-indigo-100"
                              : "border border-orange-400/40 bg-orange-500/20 text-orange-100"
                        }`}
                      >
                        {list.length}
                      </span>
                    </div>
                    <ul className="max-h-[min(420px,55vh)] space-y-2 overflow-y-auto pr-1">
                      {list.map((c) => (
                        <li
                          key={c.id}
                          className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white/90"
                        >
                          <div className="flex items-start gap-2">
                            <User className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{c.nom}</p>
                              <p className="mt-0.5 text-xs text-white/45">
                                R {c.recenceJours} j · F {c.frequence} ·{" "}
                                {formatMoney(c.montant)}
                              </p>
                              {key === "endormi" && (
                                <button
                                  type="button"
                                  onClick={() => setModalClient(c)}
                                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-orange-400/40 bg-gradient-to-r from-orange-500/25 to-red-500/20 px-3 py-2 text-xs font-semibold text-orange-100 transition hover:from-orange-500/35 hover:to-red-500/30"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                  📱 Générer campagne SMS (-10%)
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                );
              })}
            </motion.div>
          </>
        )}
      </div>

      {modalClient && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm md:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="crm-sms-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalClient(null);
          }}
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-300" />
              <h3 id="crm-sms-title" className="text-lg font-semibold text-white">
                Brouillon — campagne SMS
              </h3>
            </div>
            <p className="mb-3 text-sm text-white/60">
              Client :{" "}
              <span className="font-medium text-white">{modalClient.nom}</span>
              {modalClient.telephone && (
                <>
                  {" "}
                  · {modalClient.telephone}
                </>
              )}
            </p>
            <label className="block text-xs font-medium uppercase tracking-wide text-white/45">
              Message suggéré
            </label>
            <textarea
              readOnly
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm leading-relaxed text-white/90"
              rows={6}
              value={smsDraftText}
            />
            <p className="mt-2 text-xs text-white/40">
              Intégration envoi SMS à brancher (Twilio, etc.). Ceci est un
              brouillon local.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalClient(null)}
                className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(smsDraftText);
                    toast.success("Message copié dans le presse-papiers");
                    setModalClient(null);
                  } catch {
                    toast.error("Copie impossible sur ce navigateur");
                  }
                }}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Copier le texte
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
