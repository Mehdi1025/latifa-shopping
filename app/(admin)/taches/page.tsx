"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  X,
  User,
  Calendar,
  MoreVertical,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import {
  TACHE_STATUTS,
  TACHE_STATUT_LABELS,
  type TacheStatut,
} from "@/lib/tache-statuts";

type Statut = TacheStatut;

type Tache = {
  id: string;
  titre: string;
  description: string | null;
  statut: string;
  assigne_a: string | null;
  deadline: string | null;
};

type Profil = {
  id: string;
  email: string | null;
  role: string | null;
};

function formatDeadline(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isToday = d.toDateString() === today.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  if (isToday) return `Aujourd'hui, ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  if (isTomorrow) return `Demain, ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

export default function TachesPage() {
  const [taches, setTaches] = useState<Tache[]>([]);
  const [profiles, setProfiles] = useState<Profil[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const [form, setForm] = useState({
    titre: "",
    description: "",
    assigne_a: "",
    deadline: "",
  });

  const supabase = createSupabaseBrowserClient();

  const fetchData = async () => {
    setLoading(true);
    const [tachesRes, profilesRes] = await Promise.all([
      supabase.from("taches").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, email, role"),
    ]);
    setTaches((tachesRes.data as Tache[]) ?? []);
    const allProfiles = (profilesRes.data as Profil[]) ?? [];
    const filtered = allProfiles.filter(
      (p) => p.role?.toLowerCase() !== "admin"
    );
    setProfiles(filtered);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    const { error } = await supabase.from("taches").insert({
      titre: form.titre.trim(),
      description: form.description.trim() || null,
      assigne_a: form.assigne_a || null,
      deadline: form.deadline || null,
      statut: "a_faire",
    });
    setSubmitLoading(false);
    if (error) return;
    setForm({ titre: "", description: "", assigne_a: "", deadline: "" });
    setPanelOpen(false);
    fetchData();
  };

  const handleStatutChange = async (tacheId: string, newStatut: Statut) => {
    setStatusLoading(tacheId);
    setMenuOpen(null);
    await supabase.from("taches").update({ statut: newStatut }).eq("id", tacheId);
    setTaches((prev) =>
      prev.map((t) => (t.id === tacheId ? { ...t, statut: newStatut } : t))
    );
    setStatusLoading(null);
  };

  const getAssigneeName = (id: string | null): string => {
    if (!id) return "Non assigné";
    const p = profiles.find((x) => x.id === id);
    return (p?.email ?? "Vendeur").trim() || "Vendeur";
  };

  const tachesByStatut = {
    a_faire: taches.filter((t) => t.statut === "a_faire"),
    en_cours: taches.filter((t) => t.statut === "en_cours"),
    termine: taches.filter((t) => t.statut === "termine"),
  };

  const columnStyles: Record<Statut, { bg: string; header: string }> = {
    a_faire: { bg: "bg-gray-100/60", header: "text-gray-600" },
    en_cours: { bg: "bg-blue-50/60", header: "text-blue-700" },
    termine: { bg: "bg-emerald-50/60", header: "text-emerald-700" },
  };

  return (
    <div className="admin-container min-h-dvh bg-gray-50/50 p-4 md:p-6 lg:p-10">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
            Gestion des Tâches
          </h1>
          <p className="mt-1 text-sm text-gray-400 md:text-base">
            Organisez et suivez les missions de votre équipe
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="inline-flex h-12 min-h-12 items-center justify-center gap-2 rounded-2xl bg-gray-900 px-5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-gray-800 active:scale-[0.98] md:text-base"
        >
          <Plus className="h-4 w-4" />
          Nouvelle Mission
        </button>
      </header>

      {loading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {TACHE_STATUTS.map((statut) => {
            const style = columnStyles[statut];
            return (
              <div
                key={statut}
                className={`flex flex-col rounded-2xl p-4 ${style.bg}`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${style.header}`}>
                    {TACHE_STATUT_LABELS[statut]}
                  </h2>
                  <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium text-gray-500 shadow-sm">
                    {tachesByStatut[statut].length}
                  </span>
                </div>
                <div className="space-y-3 overflow-auto">
                  {tachesByStatut[statut].map((tache) => (
                    <div
                      key={tache.id}
                      className="group relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900">
                            {tache.titre}
                          </h3>
                          {tache.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                              {tache.description}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                              <User className="h-3.5 w-3.5" />
                              {getAssigneeName(tache.assigne_a)}
                            </span>
                            <span
                              className={`flex items-center gap-1.5 text-xs ${
                                isOverdue(tache.deadline) ? "font-medium text-red-600" : "text-gray-500"
                              }`}
                            >
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDeadline(tache.deadline)}
                            </span>
                          </div>
                        </div>
                        <div className="relative shrink-0">
                          {statusLoading === tache.id ? (
                            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setMenuOpen(menuOpen === tache.id ? null : tache.id)
                              }
                              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                              aria-label="Changer le statut"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          )}
                          {menuOpen === tache.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setMenuOpen(null)}
                                aria-hidden="true"
                              />
                              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
                                {TACHE_STATUTS.filter((s) => s !== tache.statut).map(
                                  (s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={() =>
                                        handleStatutChange(tache.id, s)
                                      }
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                                    >
                                      <ChevronRight className="h-3.5 w-3.5" />
                                      Passer en « {TACHE_STATUT_LABELS[s]} »
                                    </button>
                                  )
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Panneau latéral Nouvelle Mission */}
      {panelOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm"
            onClick={() => !submitLoading && setPanelOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Nouvelle Mission
              </h2>
              <button
                type="button"
                onClick={() => !submitLoading && setPanelOpen(false)}
                disabled={submitLoading}
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 disabled:opacity-50"
                aria-label="Fermer"
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
                  <label
                    htmlFor="titre"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Titre *
                  </label>
                  <input
                    id="titre"
                    type="text"
                    required
                    value={form.titre}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, titre: e.target.value }))
                    }
                    placeholder="Ex : Poster 2 TikTok avec la nouvelle robe"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="description"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={4}
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="Détails de la mission..."
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="assigne_a"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Assigné à
                  </label>
                  <select
                    id="assigne_a"
                    value={form.assigne_a}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, assigne_a: e.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  >
                    <option value="">Non assigné</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.email?.trim() || "Vendeur"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="deadline"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Date limite
                  </label>
                  <input
                    id="deadline"
                    type="datetime-local"
                    value={form.deadline}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, deadline: e.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
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
                    "Créer la mission"
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
