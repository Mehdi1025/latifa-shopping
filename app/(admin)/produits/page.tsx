"use client";

import { useState, useEffect, useMemo } from "react";
import { AlertCircle, Plus, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import type { Produit } from "@/types/produit";
import { normalizeEan13String } from "@/lib/produit-import";

function StatutBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
        <AlertCircle className="h-3.5 w-3.5" />
        Rupture
      </span>
    );
  }
  if (stock < 5) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
        Stock faible
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
      En stock
    </span>
  );
}

function formatPrix(prix: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(prix);
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

  return (
    <div className="admin-container min-h-dvh p-4 sm:p-6 lg:p-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl md:text-3xl">
          Produits & Stock
        </h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex h-12 min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white shadow-sm transition-all duration-300 ease-in-out hover:bg-indigo-700 hover:shadow md:text-base"
        >
          <Plus className="h-4 w-4" />
          Ajouter un produit
        </button>
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
          {/* Tableau tablette+ — défilement horizontal */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="min-w-[880px] w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-6 md:py-5">
                    Produit
                  </th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-6 md:py-5">
                    Taille
                  </th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-6 md:py-5">
                    Couleur
                  </th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-6 md:py-5">
                    Catégorie
                  </th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-6 md:py-5">
                    Prix
                  </th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-6 md:py-5">
                    Stock
                  </th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-6 md:py-5">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody>
                {produitsFiltres.map((produit, i) => (
                  <tr
                    key={produit.id}
                    className={`border-b border-slate-100 transition-colors duration-300 last:border-b-0 hover:bg-indigo-50/30 ${
                      i % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                    }`}
                  >
                    <td className="px-4 py-4 md:px-6 md:py-5">
                      <div>
                        <p className="whitespace-nowrap text-sm font-medium text-slate-900">
                          {produit.nom}
                        </p>
                        {produit.code_barre && (
                          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500">
                            {produit.code_barre}
                          </p>
                        )}
                        {produit.description && (
                          <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
                            {produit.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 md:px-6 md:py-5">
                      {produit.taille?.trim() ? (
                        <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {produit.taille}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 md:px-6 md:py-5">
                      {produit.couleur?.trim() ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-800">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-200 bg-violet-100"
                            title={produit.couleur}
                            aria-hidden
                          />
                          {produit.couleur}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-500 md:px-6 md:py-5">
                      {produit.categorie ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-700 md:px-6 md:py-5">
                      {formatPrix(produit.prix)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-500 md:px-6 md:py-5">
                      {produit.stock}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 md:px-6 md:py-5">
                      <StatutBadge stock={produit.stock} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartes mobile */}
          <div className="space-y-4 md:hidden">
            {produitsFiltres.map((produit) => (
              <article
                key={produit.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 ease-in-out hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-slate-900">{produit.nom}</h3>
                    {produit.code_barre && (
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500">
                        {produit.code_barre}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-slate-500">
                      {produit.categorie ?? "—"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {produit.taille?.trim() && (
                        <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {produit.taille}
                        </span>
                      )}
                      {produit.couleur?.trim() && (
                        <span className="text-xs text-slate-600">{produit.couleur}</span>
                      )}
                    </div>
                    {produit.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                        {produit.description}
                      </p>
                    )}
                  </div>
                  <StatutBadge stock={produit.stock} />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-sm text-slate-500">
                    Prix : {formatPrix(produit.prix)}
                  </span>
                  <span className="text-sm font-medium text-slate-700">
                    Stock : {produit.stock}
                  </span>
                </div>
              </article>
            ))}
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
    </div>
  );
}
