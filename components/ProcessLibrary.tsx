"use client";

import { useState, useEffect } from "react";
import { Store, Headset, Package, Smartphone, Plus, X, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type ProcessItem = {
  id: string;
  titre: string;
  categorie: string;
  contenu: string | null;
};

const CATEGORIES: Record<string, { icon: typeof Store; color: string }> = {
  Vente: { icon: Store, color: "bg-emerald-100 text-emerald-700" },
  SAV: { icon: Headset, color: "bg-amber-100 text-amber-700" },
  Stock: { icon: Package, color: "bg-blue-100 text-blue-700" },
  "Réseaux Sociaux": { icon: Smartphone, color: "bg-violet-100 text-violet-700" },
};

const DEFAULT_ICON = Store;
const DEFAULT_COLOR = "bg-gray-100 text-gray-700";

function excerpt(text: string | null, maxLen = 100): string {
  if (!text) return "";
  const plain = text.replace(/#+|\*|-/g, "").trim();
  return plain.length <= maxLen ? plain : plain.slice(0, maxLen) + "…";
}

type ProcessLibraryProps = {
  isAdmin?: boolean;
};

export default function ProcessLibrary({ isAdmin = false }: ProcessLibraryProps) {
  const [items, setItems] = useState<ProcessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ProcessItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [form, setForm] = useState({
    titre: "",
    categorie: "Vente",
    contenu: "",
  });

  const supabase = createSupabaseBrowserClient();

  const fetchProcess = async () => {
    const { data } = await supabase
      .from("process")
      .select("id, titre, categorie, contenu")
      .order("created_at", { ascending: false });
    setItems((data as ProcessItem[]) ?? []);
  };

  useEffect(() => {
    setLoading(true);
    fetchProcess().finally(() => setLoading(false));
  }, []);

  const handleCardClick = (item: ProcessItem) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    await supabase.from("process").insert({
      titre: form.titre.trim(),
      categorie: form.categorie,
      contenu: form.contenu.trim() || null,
    });
    setSubmitLoading(false);
    setForm({ titre: "", categorie: "Vente", contenu: "" });
    setFormOpen(false);
    fetchProcess();
  };

  const catConfig = (c: string) =>
    CATEGORIES[c] ?? { icon: DEFAULT_ICON, color: DEFAULT_COLOR };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 lg:p-10">
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 lg:text-3xl">
            {isAdmin ? "Bibliothèque de Process" : "Guide Interne"}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {isAdmin
              ? "Consignes et procédures pour l'équipe"
              : "Vos consignes et procédures"}
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-gray-800 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Nouveau Process
          </button>
        )}
      </header>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-sm">
          <p className="text-gray-500">
            Aucun process pour le moment.
            {isAdmin && " Cliquez sur « Nouveau Process » pour commencer."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const { icon: Icon, color } = catConfig(item.categorie);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleCardClick(item)}
                className="group flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900">{item.titre}</h3>
                  <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                    {excerpt(item.contenu)}
                  </p>
                  {item.categorie && (
                    <span className="mt-3 inline-block text-xs font-medium text-gray-400">
                      {item.categorie}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Slide-over lecture */}
      {drawerOpen && selectedItem && (
        <>
          <div
            className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedItem.titre}
                </h2>
                <p className="mt-0.5 text-sm text-gray-400">
                  {selectedItem.categorie}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <article className="process-content text-gray-700 [&_h1]:mb-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-base [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1 [&_p]:mb-4 [&_p]:leading-relaxed">
                <ReactMarkdown>{selectedItem.contenu ?? ""}</ReactMarkdown>
              </article>
            </div>
          </div>
        </>
      )}

      {/* Panneau Nouveau Process (Admin) */}
      {formOpen && isAdmin && (
        <>
          <div
            className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm"
            onClick={() => !submitLoading && setFormOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Nouveau Process
              </h2>
              <button
                type="button"
                onClick={() => !submitLoading && setFormOpen(false)}
                disabled={submitLoading}
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={handleSubmit}
              className="flex flex-1 flex-col overflow-y-auto px-6 py-5"
            >
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Titre *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.titre}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, titre: e.target.value }))
                    }
                    placeholder="Ex : Script d'accueil"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Catégorie *
                  </label>
                  <select
                    value={form.categorie}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, categorie: e.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  >
                    <option value="Vente">Vente</option>
                    <option value="SAV">SAV</option>
                    <option value="Stock">Stock</option>
                    <option value="Réseaux Sociaux">Réseaux Sociaux</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Contenu (Markdown)
                  </label>
                  <textarea
                    value={form.contenu}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, contenu: e.target.value }))
                    }
                    rows={12}
                    placeholder="## Introduction&#10;&#10;- Point 1&#10;- Point 2"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 font-mono text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
              </div>
              <div className="mt-auto border-t border-gray-100 pt-6">
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:bg-gray-800 active:scale-[0.98] disabled:opacity-70"
                >
                  {submitLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Créer le process"
                  )}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
