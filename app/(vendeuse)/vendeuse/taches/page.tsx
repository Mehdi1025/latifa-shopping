"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckSquare, Calendar, CheckCircle, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { isTacheTerminee } from "@/lib/tache-statuts";

type Tache = {
  id: string;
  titre: string;
  description: string | null;
  statut: string;
  assigne_a: string | null;
  deadline: string | null;
};

function formatDeadline(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isToday = d.toDateString() === today.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  if (isToday)
    return `Aujourd'hui, ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  if (isTomorrow)
    return `Demain, ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VendeuseTachesPage() {
  const [taches, setTaches] = useState<Tache[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success"; message: string } | null>(null);

  const supabase = createSupabaseBrowserClient();

  const fetchTaches = async (uid: string) => {
    const { data } = await supabase
      .from("taches")
      .select("*")
      .eq("assigne_a", uid)
      .order("deadline", { ascending: true });
    setTaches((data as Tache[]) ?? []);
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      await fetchTaches(user.id);
      setLoading(false);
    };
    init();
  }, []);

  const handleTermine = async (tacheId: string) => {
    setCompletingId(tacheId);
    const { error } = await supabase
      .from("taches")
      .update({ statut: "termine" })
      .eq("id", tacheId);
    setCompletingId(null);
    if (error) return;
    setTaches((prev) =>
      prev.map((t) => (t.id === tacheId ? { ...t, statut: "termine" } : t))
    );
    setToast({ type: "success", message: "Mission accomplie !" });
    setTimeout(() => setToast(null), 4000);
  };

  const tachesEnCours = taches.filter((t) => !isTacheTerminee(t.statut));
  const tachesTerminees = taches.filter((t) => isTacheTerminee(t.statut));

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 lg:p-10">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 lg:text-3xl">
          Mes Missions
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Vos tâches assignées
        </p>
      </header>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="fixed top-20 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-emerald-600 px-6 py-4 text-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] lg:top-8"
          >
            <CheckCircle className="h-6 w-6 shrink-0" />
            <span className="font-semibold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
        </div>
      ) : !userId ? (
        <p className="py-12 text-center text-gray-400">
          Veuillez vous connecter pour voir vos missions.
        </p>
      ) : taches.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-sm">
          <CheckSquare className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">Aucune mission assignée.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {tachesEnCours.map((tache) => (
            <div
              key={tache.id}
              className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => handleTermine(tache.id)}
                disabled={completingId === tache.id}
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 transition-all duration-300 hover:border-emerald-500 hover:bg-emerald-50 active:scale-95 disabled:opacity-50"
                aria-label="Marquer comme terminé"
              >
                {completingId === tache.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                ) : null}
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900">{tache.titre}</h3>
                {tache.description && (
                  <p className="mt-2 text-sm text-gray-500">{tache.description}</p>
                )}
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDeadline(tache.deadline)}
                </div>
              </div>
            </div>
          ))}

          {tachesTerminees.length > 0 && (
            <>
              <h2 className="mt-10 text-sm font-medium uppercase tracking-wider text-gray-400">
                Terminées
              </h2>
              {tachesTerminees.map((tache) => (
                <div
                  key={tache.id}
                  className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-gray-50/80 p-6 shadow-sm"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-500 line-through">
                      {tache.titre}
                    </h3>
                    {tache.description && (
                      <p className="mt-2 text-sm text-gray-400 line-through">
                        {tache.description}
                      </p>
                    )}
                    <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDeadline(tache.deadline)}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
