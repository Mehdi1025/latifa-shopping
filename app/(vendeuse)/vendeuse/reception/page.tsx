"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Plus,
  Search,
  ShoppingBag,
  X,
  Loader2,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useAlerts } from "@/hooks/useAlerts";
import ActionCenter from "@/components/ActionCenter";
import ReceptionStockQuickLinks from "@/components/vendeur/ReceptionStockQuickLinks";
import { toast } from "sonner";
import type { Produit } from "@/types/produit";
import { normalizeEan13String } from "@/lib/produit-import";
import { logStockMovement } from "@/lib/stock/mouvements-stock";

function ProductThumb() {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 ring-1 ring-gray-100">
      <ShoppingBag className="h-8 w-8 text-gray-300" aria-hidden />
    </div>
  );
}

export default function ReceptionMarchandisePage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { alerts, loading: alertesLoading, refetch: refetchAlertes } = useAlerts({
    includeTasks: false,
    includeAdminIntelligence: false,
    stockLink: { href: "/vendeuse/reception", actionLabel: "Réception" },
  });
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [arrivage, setArrivage] = useState<Record<string, number>>({});
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [submitProduct, setSubmitProduct] = useState(false);
  const [form, setForm] = useState({
    nom: "",
    prix: "",
    categorie: "",
    stock: "",
    code_barre: "",
    taille: "",
    couleur: "",
  });

  const fetchProduits = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("produits")
      .select("id, nom, description, prix, stock, categorie, code_barre, taille, couleur")
      .order("nom", { ascending: true });
    if (error) {
      toast.error(error.message);
      setProduits([]);
    } else {
      setProduits((data as Produit[]) ?? []);
    }
    setLoading(false);
    void refetchAlertes();
  }, [supabase, refetchAlertes]);

  useEffect(() => {
    fetchProduits();
  }, [fetchProduits]);

  const categoriesExistantes = useMemo(() => {
    const s = new Set<string>();
    produits.forEach((p) => {
      if (p.categorie?.trim()) s.add(p.categorie.trim());
    });
    return Array.from(s).sort();
  }, [produits]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return produits;
    return produits.filter((p) => {
      const ean = p.code_barre ?? "";
      const qDigits = q.replace(/\D/g, "");
      return (
        p.nom.toLowerCase().includes(q) ||
        (p.categorie ?? "").toLowerCase().includes(q) ||
        (ean && ean.toLowerCase().includes(q)) ||
        (qDigits.length >= 4 && ean.replace(/\D/g, "").includes(qDigits))
      );
    });
  }, [produits, search]);

  const bump = (id: string, delta: number) => {
    setArrivage((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  };

  const setArrivageDirect = (id: string, value: string) => {
    const n = parseInt(value, 10);
    if (value === "" || Number.isNaN(n)) {
      setArrivage((prev) => {
        const c = { ...prev };
        delete c[id];
        return c;
      });
      return;
    }
    const v = Math.max(0, Math.min(99999, n));
    setArrivage((prev) => ({ ...prev, [id]: v }));
  };

  const validerReception = async (p: Produit) => {
    const qty = arrivage[p.id] ?? 0;
    if (qty <= 0) {
      toast.error("Indiquez une quantité à ajouter (minimum 1).");
      return;
    }
    setValidatingId(p.id);
    try {
      const newStock = p.stock + qty;
      const { error } = await supabase
        .from("produits")
        .update({ stock: newStock })
        .eq("id", p.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      const { error: mvtErr } = await logStockMovement(supabase, {
        produit_id: p.id,
        quantite: qty,
        type_mouvement: "RECEPTION",
        reference: "Réception marchandise",
      });
      if (mvtErr) {
        toast.error(mvtErr.message);
        return;
      }
      setProduits((list) =>
        list.map((x) => (x.id === p.id ? { ...x, stock: newStock } : x))
      );
      setArrivage((prev) => {
        const c = { ...prev };
        delete c[p.id];
        return c;
      });
      setSuccessId(p.id);
      toast.success(`${qty} unité(s) ajoutée(s) — ${p.nom}`);
      void refetchAlertes();
      window.setTimeout(() => setSuccessId((cur) => (cur === p.id ? null : cur)), 2000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la mise à jour.");
    } finally {
      setValidatingId(null);
    }
  };

  const handleNouveauProduit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prixNum = parseFloat(form.prix.replace(",", "."));
    const stockNum = parseInt(form.stock, 10);
    if (!form.nom.trim()) {
      toast.error("Le nom est obligatoire.");
      return;
    }
    if (Number.isNaN(prixNum) || prixNum < 0) {
      toast.error("Prix invalide.");
      return;
    }
    if (Number.isNaN(stockNum) || stockNum < 0) {
      toast.error("Quantité initiale invalide.");
      return;
    }
    const eanRaw = form.code_barre.trim();
    const ean = eanRaw ? normalizeEan13String(eanRaw) : null;
    if (eanRaw && !ean) {
      toast.error("EAN-13 : 13 chiffres ou laissez le champ vide.");
      return;
    }
    setSubmitProduct(true);
    const { error } = await supabase.from("produits").insert({
      nom: form.nom.trim(),
      description: null,
      prix: prixNum,
      stock: stockNum,
      categorie: form.categorie.trim() || null,
      code_barre: ean,
      taille: form.taille.trim() || null,
      couleur: form.couleur.trim() || null,
    });
    setSubmitProduct(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Produit créé.");
    setForm({ nom: "", prix: "", categorie: "", stock: "", code_barre: "", taille: "", couleur: "" });
    setModalOpen(false);
    await fetchProduits();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 pb-28 pt-4 md:px-6 md:pb-10 md:pt-8">
      <header className="mb-6 md:mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 text-white shadow-lg">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 md:text-2xl">
              Réception marchandise
            </h1>
            <p className="text-sm text-gray-500">
              Entrées de stock — même logique que l&apos;admin
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,360px)] xl:grid-cols-[1fr_380px]">
        <div className="order-2 min-w-0 space-y-5 lg:order-1">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un produit…"
                className="w-full min-h-[52px] rounded-2xl border border-gray-200 bg-white py-3 pl-12 pr-4 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                aria-label="Recherche produit"
              />
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-base font-semibold text-white shadow-md transition active:scale-[0.98] hover:bg-emerald-700"
            >
              <Plus className="h-5 w-5" />
              Créer un nouveau produit
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center text-gray-500">
              {search.trim()
                ? "Aucun produit ne correspond à votre recherche."
                : "Aucun produit en base."}
            </p>
          ) : (
            <ul className="space-y-4">
              {filtered.map((p) => {
                const q = arrivage[p.id] ?? 0;
                const busy = validatingId === p.id;
                const ok = successId === p.id;
                return (
                  <motion.li
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm ring-1 ring-gray-100/80 md:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 gap-4">
                        <ProductThumb />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-lg font-semibold text-gray-900">
                            {p.nom}
                          </p>
                          {p.categorie && (
                            <p className="mt-0.5 text-sm text-gray-400">{p.categorie}</p>
                          )}
                          <p className="mt-2 text-sm text-gray-600">
                            Stock actuel :{" "}
                            <span className="font-bold tabular-nums text-gray-900">
                              {p.stock}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:items-end">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                            Arrivage
                          </span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={q || ""}
                            onChange={(e) => setArrivageDirect(p.id, e.target.value)}
                            placeholder="0"
                            className="h-12 w-20 rounded-xl border border-gray-200 bg-gray-50/80 text-center text-lg font-bold tabular-nums text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15"
                          />
                          {([1, 5, 10] as const).map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => bump(p.id, n)}
                              className="min-h-12 min-w-[52px] rounded-xl bg-gray-100 px-3 text-sm font-bold text-gray-800 transition hover:bg-gray-200 active:scale-95"
                            >
                              +{n}
                            </button>
                          ))}
                        </div>
                        <motion.button
                          type="button"
                          disabled={busy || q <= 0}
                          onClick={() => validerReception(p)}
                          className={`relative flex min-h-[56px] w-full items-center justify-center overflow-hidden rounded-2xl px-6 text-base font-bold text-white shadow-md transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[220px] ${
                            ok ? "bg-emerald-600" : "bg-gray-900"
                          }`}
                          whileTap={{ scale: 0.98 }}
                        >
                          <AnimatePresence mode="wait" initial={false}>
                            {ok ? (
                              <motion.span
                                key="ok"
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="absolute inset-0 flex items-center justify-center"
                              >
                                ✅ Fait
                              </motion.span>
                            ) : (
                              <motion.span
                                key="go"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center justify-center gap-2"
                              >
                                {busy ? (
                                  <Loader2 className="h-6 w-6 animate-spin" />
                                ) : (
                                  "Valider la réception"
                                )}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="order-1 space-y-4 lg:sticky lg:top-4 lg:order-2 lg:max-h-[min(100dvh,900px)] lg:overflow-y-auto lg:self-start">
          <ActionCenter
            title="Alertes de stock"
            variant="full"
            alerts={alerts}
            loading={alertesLoading}
          />
          <ReceptionStockQuickLinks
            alerts={alerts}
            produits={produits}
            onAddOne={(id) => bump(id, 1)}
          />
        </aside>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-gray-900/50 backdrop-blur-sm"
              onClick={() => !submitProduct && setModalOpen(false)}
            />
            <motion.div
              data-skip-ean-capture
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed left-1/2 top-1/2 z-[110] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-gray-100"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Nouveau produit</h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={submitProduct}
                  className="rounded-full p-2 text-gray-400 hover:bg-gray-100"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleNouveauProduit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">Nom</label>
                  <input
                    required
                    value={form.nom}
                    onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                    className="mt-1 min-h-[48px] w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    placeholder="Ex. Abaya satin"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Prix (€)</label>
                  <input
                    required
                    inputMode="decimal"
                    value={form.prix}
                    onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))}
                    className="mt-1 min-h-[48px] w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Catégorie</label>
                  <input
                    value={form.categorie}
                    onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}
                    list="cats-reception"
                    className="mt-1 min-h-[48px] w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    placeholder="Optionnel"
                  />
                  <datalist id="cats-reception">
                    {categoriesExistantes.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">EAN-13 (optionnel)</label>
                  <input
                    value={form.code_barre}
                    onChange={(e) => setForm((f) => ({ ...f, code_barre: e.target.value }))}
                    inputMode="numeric"
                    autoComplete="off"
                    className="mt-1 min-h-[48px] w-full rounded-xl border border-gray-200 px-4 py-3 font-mono text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    placeholder="13 chiffres"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Taille</label>
                    <input
                      value={form.taille}
                      onChange={(e) => setForm((f) => ({ ...f, taille: e.target.value }))}
                      className="mt-1 min-h-[48px] w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      placeholder="ex. T.60"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Couleur</label>
                    <input
                      value={form.couleur}
                      onChange={(e) => setForm((f) => ({ ...f, couleur: e.target.value }))}
                      className="mt-1 min-h-[48px] w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      placeholder="ex. Blanc"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">
                    Quantité initiale (stock)
                  </label>
                  <input
                    required
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={form.stock}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                    className="mt-1 min-h-[48px] w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    placeholder="0"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitProduct}
                  className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-gray-900 text-base font-bold text-white transition hover:bg-gray-800 disabled:opacity-60"
                >
                  {submitProduct ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    "Enregistrer le produit"
                  )}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
