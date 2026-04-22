"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, History, Pencil, Plus, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import type { Produit } from "@/types/produit";
import { normalizeEan13String } from "@/lib/produit-import";
import { logStockMovement } from "@/lib/stock/mouvements-stock";
import StockMouvementsHistoriqueDialog from "@/components/admin/StockMouvementsHistoriqueDialog";
import {
  groupeProduitsParNom,
  isStockAgregTresBas,
} from "@/lib/admin/groupe-produits-modele";

function formatPrix(prix: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(prix);
}

function formatPrixRange(min: number, max: number): string {
  if (min === max) return formatPrix(min);
  return `${formatPrix(min)} – ${formatPrix(max)}`;
}

function libelleVariantePourHistorique(p: Produit): string {
  const parts: string[] = [p.nom.trim() || "Produit"];
  if (p.couleur?.trim()) parts.push(p.couleur.trim());
  if (p.taille?.trim()) parts.push(p.taille.trim());
  if (p.code_barre) parts.push(`EAN ${p.code_barre}`);
  return parts.join(" · ");
}

export default function ProduitsPage() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterCategorie, setFilterCategorie] = useState("Tous");
  const [filterTaille, setFilterTaille] = useState("Tous");
  const [filterCouleur, setFilterCouleur] = useState("Tous");

  const [form, setForm] = useState({
    nom: "",
    description: "",
    prix: "",
    stock: "",
    categorie: "",
    code_barre: "",
    taille: "",
    couleur: "",
  });

  const [mvtHistoriqueProduit, setMvtHistoriqueProduit] = useState<Produit | null>(null);
  const [editingProduit, setEditingProduit] = useState<Produit | null>(null);
  const [editSubmitLoading, setEditSubmitLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    nom: "",
    description: "",
    prix: "",
    stock: "",
    categorie: "",
    code_barre: "",
    taille: "",
    couleur: "",
  });

  const [expandedCles, setExpandedCles] = useState<Set<string>>(() => new Set());

  const supabase = createSupabaseBrowserClient();

  const fetchProduits = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("produits")
      .select("*")
      .order("created_at", { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
      setProduits([]);
    } else {
      setProduits((data as Produit[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProduits();
  }, []);

  const categoriesOptions = useMemo(() => {
    const s = new Set<string>();
    produits.forEach((p) => {
      if (p.categorie?.trim()) s.add(p.categorie.trim());
    });
    return ["Tous", ...Array.from(s).sort()];
  }, [produits]);

  const taillesOptions = useMemo(() => {
    const s = new Set<string>();
    produits.forEach((p) => {
      if (p.taille?.trim()) s.add(p.taille.trim());
    });
    return ["Tous", ...Array.from(s).sort((a, b) => a.localeCompare(b, "fr"))];
  }, [produits]);

  const couleursOptions = useMemo(() => {
    const s = new Set<string>();
    produits.forEach((p) => {
      if (p.couleur?.trim()) s.add(p.couleur.trim());
    });
    return ["Tous", ...Array.from(s).sort((a, b) => a.localeCompare(b, "fr"))];
  }, [produits]);

  const produitsFiltres = useMemo(() => {
    return produits.filter((p) => {
      if (filterCategorie !== "Tous" && (p.categorie ?? "").trim() !== filterCategorie) {
        return false;
      }
      if (filterTaille !== "Tous" && (p.taille ?? "").trim() !== filterTaille) {
        return false;
      }
      if (filterCouleur !== "Tous" && (p.couleur ?? "").trim() !== filterCouleur) {
        return false;
      }
      return true;
    });
  }, [produits, filterCategorie, filterTaille, filterCouleur]);

  const groupesModeles = useMemo(
    () => groupeProduitsParNom(produitsFiltres),
    [produitsFiltres]
  );

  const ouvrirEdition = (p: Produit) => {
    const prixStr = Number.isInteger(p.prix)
      ? String(p.prix)
      : p.prix.toFixed(2).replace(".", ",");
    setEditForm({
      nom: p.nom,
      description: p.description ?? "",
      prix: prixStr,
      stock: String(p.stock),
      categorie: p.categorie ?? "",
      code_barre: p.code_barre ?? "",
      taille: p.taille ?? "",
      couleur: p.couleur ?? "",
    });
    setEditingProduit(p);
  };

  const toggleExpanded = (cle: string) => {
    setExpandedCles((prev) => {
      const n = new Set(prev);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });
  };

  const toutDeplier = useCallback(() => {
    setExpandedCles(new Set(groupesModeles.map((g) => g.cle)));
  }, [groupesModeles]);

  const toutReplier = useCallback(() => {
    setExpandedCles(new Set());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError(null);
    const prixNum = parseFloat(form.prix.replace(",", "."));
    const stockNum = parseInt(form.stock, 10);
    if (isNaN(prixNum) || isNaN(stockNum)) {
      setError("Prix et Stock doivent être des nombres valides.");
      setSubmitLoading(false);
      return;
    }
    const eanRaw = form.code_barre.trim();
    const ean = eanRaw ? normalizeEan13String(eanRaw) : null;
    if (eanRaw && !ean) {
      setError("EAN-13 : saisissez exactement 13 chiffres (ou laissez vide).");
      setSubmitLoading(false);
      return;
    }
    const { error: insertError } = await supabase.from("produits").insert({
      nom: form.nom.trim(),
      description: form.description.trim() || null,
      prix: prixNum,
      stock: stockNum,
      categorie: form.categorie.trim() || null,
      code_barre: ean,
      taille: form.taille.trim() || null,
      couleur: form.couleur.trim() || null,
    });
    if (insertError) {
      setError(insertError.message);
      setSubmitLoading(false);
      return;
    }
    setForm({
      nom: "",
      description: "",
      prix: "",
      stock: "",
      categorie: "",
      code_barre: "",
      taille: "",
      couleur: "",
    });
    setModalOpen(false);
    await fetchProduits();
    setSubmitLoading(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduit) return;
    setEditSubmitLoading(true);
    setError(null);
    const prixNum = parseFloat(editForm.prix.replace(",", "."));
    const stockNum = parseInt(editForm.stock, 10);
    if (isNaN(prixNum) || isNaN(stockNum)) {
      setError("Prix et Stock doivent être des nombres valides.");
      setEditSubmitLoading(false);
      return;
    }
    const eanRaw = editForm.code_barre.trim();
    const ean = eanRaw ? normalizeEan13String(eanRaw) : null;
    if (eanRaw && !ean) {
      setError("EAN-13 : saisissez exactement 13 chiffres (ou laissez vide).");
      setEditSubmitLoading(false);
      return;
    }
    const { error: upError } = await supabase
      .from("produits")
      .update({
        nom: editForm.nom.trim(),
        description: editForm.description.trim() || null,
        prix: prixNum,
        stock: stockNum,
        categorie: editForm.categorie.trim() || null,
        code_barre: ean,
        taille: editForm.taille.trim() || null,
        couleur: editForm.couleur.trim() || null,
      })
      .eq("id", editingProduit.id);
    if (upError) {
      setError(upError.message);
      setEditSubmitLoading(false);
      return;
    }
    const delta = stockNum - editingProduit.stock;
    if (delta !== 0) {
      const { error: mvtErr } = await logStockMovement(supabase, {
        produit_id: editingProduit.id,
        quantite: delta,
        type_mouvement: "INVENTAIRE",
        reference: "Ajustement manuel",
      });
      if (mvtErr) {
        setError(mvtErr.message);
        setEditSubmitLoading(false);
        return;
      }
    }
    setEditingProduit(null);
    await fetchProduits();
    setEditSubmitLoading(false);
  };

  return (
    <div className="admin-container min-h-dvh p-4 sm:p-6 lg:p-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl md:text-3xl">
          Produits & Stock
        </h1>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {!loading && produits.length > 0 && groupesModeles.length > 0 && (
            <>
              <button
                type="button"
                onClick={toutDeplier}
                className="inline-flex h-10 min-h-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Tout déplier
              </button>
              <button
                type="button"
                onClick={toutReplier}
                className="inline-flex h-10 min-h-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Tout replier
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex h-12 min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white shadow-sm transition-all duration-300 ease-in-out hover:bg-indigo-700 hover:shadow md:text-base"
          >
            <Plus className="h-4 w-4" />
            Ajouter un produit
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && produits.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 sm:max-w-xs">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Catégorie
            </label>
            <select
              value={filterCategorie}
              onChange={(e) => setFilterCategorie(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {categoriesOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 sm:max-w-xs">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Taille
            </label>
            <select
              value={filterTaille}
              onChange={(e) => setFilterTaille(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {taillesOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 sm:max-w-xs">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Couleur
            </label>
            <select
              value={filterCouleur}
              onChange={(e) => setFilterCouleur(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {couleursOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
      ) : produits.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500">Aucun produit pour le moment.</p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-4 inline-flex h-12 min-h-12 items-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 md:text-base"
          >
            <Plus className="h-4 w-4" />
            Ajouter un produit
          </button>
        </div>
      ) : produitsFiltres.length === 0 ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-8 text-center text-slate-700">
          Aucun produit ne correspond aux filtres sélectionnés.
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="min-w-[700px] w-full table-fixed">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="w-12 px-2 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-3 md:py-4" />
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-5 md:py-4">
                    Modèle
                  </th>
                  <th className="w-36 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-5 md:py-4">
                    Catégorie
                  </th>
                  <th className="w-32 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-5 md:py-4">
                    Stock total
                  </th>
                  <th className="w-44 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-5 md:py-4">
                    Prix
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupesModeles.map((groupe) => {
                  const expanded = expandedCles.has(groupe.cle);
                  const agregTresBas = isStockAgregTresBas(groupe.stockTotal);
                  return (
                    <Fragment key={groupe.cle}>
                      <tr
                        className="cursor-pointer border-b border-slate-100 transition-colors duration-200 hover:bg-indigo-50/40 data-[open=true]:bg-indigo-50/20"
                        data-open={expanded}
                        onClick={() => toggleExpanded(groupe.cle)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleExpanded(groupe.cle);
                          }
                        }}
                        aria-expanded={expanded}
                      >
                        <td className="align-middle px-2 py-3.5 pl-3 md:px-3 md:py-4">
                          <span className="inline-flex h-8 w-8 items-center justify-center text-slate-500">
                            {expanded ? (
                              <ChevronDown className="h-5 w-5" aria-hidden />
                            ) : (
                              <ChevronRight className="h-5 w-5" aria-hidden />
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 align-middle md:px-5 md:py-4">
                          <p className="font-bold text-slate-900">{groupe.nom}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {groupe.variantesCount} variante
                            {groupe.variantesCount > 1 ? "s" : ""}
                          </p>
                        </td>
                        <td className="px-3 py-3.5 align-middle md:px-5 md:py-4">
                          {groupe.categorieAffiche ? (
                            <span
                              className="inline-flex max-w-full items-center rounded-full border border-slate-200/80 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                              title={
                                groupe.categoriesDistinctes.length > 1
                                  ? groupe.categoriesDistinctes.join(", ")
                                  : undefined
                              }
                            >
                              {groupe.categorieAffiche}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 align-middle md:px-5 md:py-4">
                          <div className="flex items-center gap-2">
                            {agregTresBas && (
                              <span
                                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
                                title="Stock total faible"
                                aria-label="Alerte stock total faible"
                              />
                            )}
                            <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-800">
                              {groupe.stockTotal}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 align-middle text-sm font-medium text-slate-800 md:px-5 md:py-4">
                          {formatPrixRange(groupe.prixMin, groupe.prixMax)}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-slate-200 bg-slate-50/60">
                          <td colSpan={5} className="p-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="border-l-4 border-indigo-200 py-2 pl-6 pr-3 md:pl-8">
                                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                  Variantes
                                </p>
                                <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-slate-50/90">
                                  <table className="w-full min-w-[560px] text-left text-sm">
                                    <thead>
                                      <tr className="border-b border-slate-200 bg-white/80">
                                        <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                          EAN-13
                                        </th>
                                        <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                          Couleur
                                        </th>
                                        <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                          Taille
                                        </th>
                                        <th className="w-20 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                          Stock
                                        </th>
                                        <th className="min-w-[7.5rem] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                          Actions
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {groupe.variantes.map((v) => (
                                        <tr
                                          key={v.id}
                                          className="border-b border-slate-100/90 last:border-0"
                                        >
                                          <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-slate-600">
                                            {v.code_barre ?? "—"}
                                          </td>
                                          <td className="px-3 py-2.5">
                                            {v.couleur?.trim() ? (
                                              <span className="inline-flex items-center gap-1.5 text-xs text-slate-800">
                                                <span
                                                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-200/80 bg-violet-200"
                                                  aria-hidden
                                                />
                                                {v.couleur}
                                              </span>
                                            ) : (
                                              <span className="text-xs text-slate-400">—</span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2.5">
                                            {v.taille?.trim() ? (
                                              <span className="inline-flex rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                                                {v.taille}
                                              </span>
                                            ) : (
                                              <span className="text-xs text-slate-400">—</span>
                                            )}
                                          </td>
                                          <td
                                            className={`px-3 py-2.5 text-xs font-semibold tabular-nums ${
                                              v.stock <= 1
                                                ? "text-red-600"
                                                : "text-slate-700"
                                            }`}
                                          >
                                            {v.stock}
                                          </td>
                                          <td className="px-2 py-2">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setMvtHistoriqueProduit(v);
                                                }}
                                                className="inline-flex h-8 min-h-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-600 transition hover:bg-slate-50"
                                                title="Historique des mouvements"
                                              >
                                                <History className="h-3.5 w-3.5" />
                                                Historique
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  ouvrirEdition(v);
                                                }}
                                                className="inline-flex h-8 min-h-0 items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50"
                                              >
                                                <Pencil className="h-3.5 w-3.5" />
                                                Modifier
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {groupesModeles.map((groupe) => {
              const expanded = expandedCles.has(groupe.cle);
              const agregTresBas = isStockAgregTresBas(groupe.stockTotal);
              return (
                <article
                  key={groupe.cle}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(groupe.cle)}
                    className="flex w-full min-h-14 items-start gap-2 p-4 text-left transition hover:bg-slate-50/80"
                    aria-expanded={expanded}
                  >
                    <span className="mt-0.5 shrink-0 text-slate-500">
                      {expanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900">{groupe.nom}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {groupe.variantesCount} variante{groupe.variantesCount > 1 ? "s" : ""}
                      </p>
                      {groupe.categorieAffiche && (
                        <span className="mt-1 inline-block rounded-full border border-slate-200/80 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          {groupe.categorieAffiche}
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <div className="flex items-center justify-end gap-1.5">
                        {agregTresBas && (
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full bg-red-500"
                            aria-label="Alerte"
                          />
                        )}
                        <span className="font-semibold text-slate-800">{groupe.stockTotal}</span>
                        <span className="text-slate-400">u.</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatPrixRange(groupe.prixMin, groupe.prixMax)}
                      </p>
                    </div>
                  </button>
                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        key={`${groupe.cle}-m`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden border-t border-slate-200 bg-slate-50/90"
                      >
                        <div className="space-y-2 p-3 pl-6">
                          {groupe.variantes.map((v) => (
                            <div
                              key={v.id}
                              className="rounded-lg border border-slate-200/90 bg-white p-3 pl-3 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  {v.code_barre && (
                                    <p className="font-mono text-[10px] tabular-nums text-slate-600">
                                      {v.code_barre}
                                    </p>
                                  )}
                                  <p className="mt-0.5 text-sm text-slate-800">
                                    {[v.couleur, v.taille]
                                      .map((s) => s?.trim())
                                      .filter(Boolean)
                                      .join(" · ") || "—"}
                                  </p>
                                </div>
                                <div className="text-right text-sm">
                                  <p
                                    className={
                                      v.stock <= 1 ? "font-bold text-red-600" : "font-semibold"
                                    }
                                  >
                                    {v.stock} st.
                                  </p>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setMvtHistoriqueProduit(v)}
                                  className="inline-flex h-9 min-h-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600"
                                >
                                  <History className="h-3.5 w-3.5" />
                                  Historique
                                </button>
                                <button
                                  type="button"
                                  onClick={() => ouvrirEdition(v)}
                                  className="inline-flex h-9 min-h-0 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 text-xs font-medium text-indigo-800"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Modifier
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </article>
              );
            })}
          </div>
        </>
      )}

      {/* Panneau latéral Ajouter un produit */}
      {modalOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => !submitLoading && setModalOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform sm:rounded-l-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-title"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <h2 id="panel-title" className="text-lg font-semibold text-slate-900">
                Nouveau produit
              </h2>
              <button
                type="button"
                onClick={() => !submitLoading && setModalOpen(false)}
                disabled={submitLoading}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto px-6 py-5">
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="nom"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Nom *
                  </label>
                  <input
                    id="nom"
                    type="text"
                    required
                    value={form.nom}
                    onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                    placeholder="Ex : Robe Satin Élégante"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="description"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="Description du produit..."
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="prix"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Prix (€) *
                    </label>
                    <input
                      id="prix"
                      type="text"
                      inputMode="decimal"
                      required
                      value={form.prix}
                      onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))}
                      placeholder="89.00"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="stock"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Stock *
                    </label>
                    <input
                      id="stock"
                      type="number"
                      min={0}
                      required
                      value={form.stock}
                      onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                      placeholder="0"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="categorie"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Catégorie
                  </label>
                  <input
                    id="categorie"
                    type="text"
                    value={form.categorie}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, categorie: e.target.value }))
                    }
                    placeholder="Ex : Robes, Abayas, Hijabs..."
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="code_barre"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Code-barres EAN-13 (optionnel)
                  </label>
                  <input
                    id="code_barre"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={form.code_barre}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, code_barre: e.target.value }))
                    }
                    placeholder="13 chiffres, ex. 366…"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 font-mono text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="taille"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Taille
                    </label>
                    <input
                      id="taille"
                      type="text"
                      value={form.taille}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, taille: e.target.value }))
                      }
                      placeholder="ex. T.60"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="couleur"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Couleur
                    </label>
                    <input
                      id="couleur"
                      type="text"
                      value={form.couleur}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, couleur: e.target.value }))
                      }
                      placeholder="ex. Blanc"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-auto border-t border-slate-200 pt-5">
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => !submitLoading && setModalOpen(false)}
                    disabled={submitLoading}
                    className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {submitLoading ? "Enregistrement..." : "Ajouter le produit"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </>
      )}

      {editingProduit && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => !editSubmitLoading && setEditingProduit(null)}
            aria-hidden="true"
          />
          <div
            className="fixed right-0 top-0 z-[60] flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform sm:rounded-l-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-panel-title"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <h2 id="edit-panel-title" className="text-lg font-semibold text-slate-900">
                Modifier la variante
              </h2>
              <button
                type="button"
                onClick={() => !editSubmitLoading && setEditingProduit(null)}
                disabled={editSubmitLoading}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={handleEditSubmit}
              className="flex flex-1 flex-col overflow-y-auto px-6 py-5"
            >
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="edit-nom"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Nom *
                  </label>
                  <input
                    id="edit-nom"
                    type="text"
                    required
                    value={editForm.nom}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, nom: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-description"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Description
                  </label>
                  <textarea
                    id="edit-description"
                    rows={3}
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, description: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="edit-prix"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Prix (€) *
                    </label>
                    <input
                      id="edit-prix"
                      type="text"
                      inputMode="decimal"
                      required
                      value={editForm.prix}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, prix: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-stock"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Stock *
                    </label>
                    <input
                      id="edit-stock"
                      type="number"
                      min={0}
                      required
                      value={editForm.stock}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, stock: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="edit-categorie"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Catégorie
                  </label>
                  <input
                    id="edit-categorie"
                    type="text"
                    value={editForm.categorie}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, categorie: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-code_barre"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Code-barres EAN-13 (optionnel)
                  </label>
                  <input
                    id="edit-code_barre"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={editForm.code_barre}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, code_barre: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 font-mono text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="edit-taille"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Taille
                    </label>
                    <input
                      id="edit-taille"
                      type="text"
                      value={editForm.taille}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, taille: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-couleur"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Couleur
                    </label>
                    <input
                      id="edit-couleur"
                      type="text"
                      value={editForm.couleur}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, couleur: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-auto border-t border-slate-200 pt-5">
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => !editSubmitLoading && setEditingProduit(null)}
                    disabled={editSubmitLoading}
                    className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {editSubmitLoading ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </>
      )}

      <StockMouvementsHistoriqueDialog
        open={mvtHistoriqueProduit !== null}
        onOpenChange={(o) => {
          if (!o) setMvtHistoriqueProduit(null);
        }}
        produitId={mvtHistoriqueProduit?.id ?? null}
        sousTitre={
          mvtHistoriqueProduit
            ? libelleVariantePourHistorique(mvtHistoriqueProduit)
            : null
        }
      />
    </div>
  );
}
