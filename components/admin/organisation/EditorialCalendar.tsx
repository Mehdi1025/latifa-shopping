"use client";

import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

export type EditorialPost = {
  id: string;
  titre: string;
  plateforme: string;
  date_publication: string;
  statut: string;
  contenu: string | null;
  created_at: string;
};

const EDITORIAL_STATUTS = [
  { value: "planifie", label: "Planifié" },
  { value: "publie", label: "Publié" },
  { value: "annule", label: "Annulé" },
] as const;

function platformBadgeClass(name: string): string {
  const n = name.trim().toLowerCase();
  if (n.includes("instagram")) {
    return "bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888] text-white shadow-sm";
  }
  if (n.includes("tiktok")) {
    return "bg-neutral-900 text-white shadow-sm";
  }
  if (n.includes("youtube")) {
    return "bg-red-600 text-white shadow-sm";
  }
  if (n.includes("linkedin")) {
    return "bg-[#0a66c2] text-white shadow-sm";
  }
  if (n.includes("facebook")) {
    return "bg-[#1877f2] text-white shadow-sm";
  }
  if (n.includes("x ") || n === "x" || n.includes("twitter")) {
    return "bg-neutral-800 text-white shadow-sm";
  }
  return "bg-slate-500/90 text-white shadow-sm";
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function platformDotClass(name: string): string {
  const n = name.trim().toLowerCase();
  if (n.includes("instagram")) return "bg-pink-500";
  if (n.includes("tiktok")) return "bg-neutral-900";
  if (n.includes("youtube")) return "bg-red-500";
  if (n.includes("linkedin")) return "bg-[#0a66c2]";
  if (n.includes("facebook")) return "bg-[#1877f2]";
  if (n.includes("x ") || n === "x" || n.includes("twitter")) return "bg-neutral-700";
  return "bg-slate-400";
}

export default function EditorialCalendar({
  posts,
  setPosts,
}: {
  posts: EditorialPost[];
  setPosts: Dispatch<SetStateAction<EditorialPost[]>>;
}) {
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [form, setForm] = useState({
    titre: "",
    plateforme: "Instagram",
    date_publication: "",
    statut: "planifie",
    contenu: "",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("editorial_calendar")
      .select("*")
      .order("date_publication", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error("Chargement du calendrier impossible", {
        description: error.message,
      });
      return;
    }
    setPosts((data ?? []) as EditorialPost[]);
  }, [supabase]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, EditorialPost[]>();
    posts.forEach((p) => {
      const key = localDateKey(new Date(p.date_publication));
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    });
    return map;
  }, [posts]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return [...posts]
      .filter((p) => new Date(p.date_publication).getTime() >= now - 86400000)
      .sort(
        (a, b) =>
          new Date(a.date_publication).getTime() -
          new Date(b.date_publication).getTime()
      )
      .slice(0, 12);
  }, [posts]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const pad = firstDow === 0 ? 6 : firstDow - 1;
  const totalDays = daysInMonth(year, month);
  const monthLabel = viewMonth.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const gridCells: { day: number | null; key: string }[] = [];
  for (let i = 0; i < pad; i++) {
    gridCells.push({ day: null, key: `p-${i}` });
  }
  for (let d = 1; d <= totalDays; d++) {
    const dt = new Date(year, month, d);
    gridCells.push({ day: d, key: localDateKey(dt) });
  }

  const openNew = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setForm({
      titre: "",
      plateforme: "Instagram",
      date_publication: d.toISOString().slice(0, 16),
      statut: "planifie",
      contenu: "",
    });
    setModalOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.titre.trim() || !form.date_publication) {
      toast.error("Titre et date sont requis");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("editorial_calendar")
      .insert({
        titre: form.titre.trim(),
        plateforme: form.plateforme.trim() || "Autre",
        date_publication: new Date(form.date_publication).toISOString(),
        statut: form.statut,
        contenu: form.contenu.trim() || null,
      })
      .select()
      .single();

    setSubmitting(false);
    if (error) {
      toast.error("Enregistrement impossible", { description: error.message });
      return;
    }
    setPosts((prev) =>
      [...prev, data as EditorialPost].sort(
        (a, b) =>
          new Date(a.date_publication).getTime() -
          new Date(b.date_publication).getTime()
      )
    );
    toast.success("Publication planifiée");
    setModalOpen(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-neutral-900">
            Calendrier éditorial
          </h3>
          <p className="text-sm text-neutral-500">
            Posts à venir et vue mensuelle
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-xl border border-white/50 bg-white/60 px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm backdrop-blur-sm transition hover:bg-white/90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Actualiser"
            )}
          </button>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-neutral-900/20 transition hover:bg-neutral-800"
          >
            <Plus className="h-4 w-4" />
            Nouveau post
          </button>
        </div>
      </div>

      <section className="rounded-[1.25rem] border border-white/50 bg-white/50 p-6 shadow-[0_8px_40px_-24px_rgba(0,0,0,0.15)] backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-600">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Prochains posts
          </h4>
        </div>
        {upcoming.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 bg-white/40 py-10 text-center text-sm text-neutral-500">
            Aucune publication à venir. Ajoutez-en une avec « Nouveau post ».
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm ring-1 ring-black/[0.03]"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-snug text-neutral-900">
                    {p.titre}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${platformBadgeClass(p.plateforme)}`}
                  >
                    {p.plateforme}
                  </span>
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  {new Date(p.date_publication).toLocaleString("fr-FR", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {p.contenu && (
                  <p className="mt-2 line-clamp-2 text-xs text-neutral-600">
                    {p.contenu}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[1.25rem] border border-white/50 bg-white/50 p-6 shadow-[0_8px_40px_-24px_rgba(0,0,0,0.15)] backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-600">
            <CalendarDays className="h-4 w-4 text-sky-500" />
            Vue mensuelle
          </h4>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              className="rounded-lg p-2 text-neutral-600 transition hover:bg-white/80"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="min-w-[10rem] text-center text-sm font-semibold capitalize text-neutral-800">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="rounded-lg p-2 text-neutral-600 transition hover:bg-white/80"
              aria-label="Mois suivant"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-neutral-400">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {gridCells.map((cell) => {
            if (cell.day === null) {
              return (
                <div key={cell.key} className="min-h-[4.5rem] rounded-xl" />
              );
            }
            const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
            const dayPosts = postsByDay.get(key) ?? [];
            const isToday =
              new Date().toDateString() ===
              new Date(year, month, cell.day).toDateString();
            return (
              <div
                key={cell.key}
                className={`flex min-h-[4.5rem] flex-col rounded-xl border p-1.5 text-left ${
                  isToday
                    ? "border-indigo-400/60 bg-indigo-50/50"
                    : "border-white/40 bg-white/30"
                }`}
              >
                <span
                  className={`text-xs font-semibold ${isToday ? "text-indigo-700" : "text-neutral-600"}`}
                >
                  {cell.day}
                </span>
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {dayPosts.slice(0, 3).map((p) => (
                    <span
                      key={p.id}
                      title={p.titre}
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${platformDotClass(p.plateforme)}`}
                    />
                  ))}
                  {dayPosts.length > 3 && (
                    <span className="text-[9px] text-neutral-400">
                      +{dayPosts.length - 3}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="editorial-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            aria-label="Fermer"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-3xl border border-white/50 bg-white/95 p-6 shadow-2xl backdrop-blur-xl">
            <h2
              id="editorial-modal-title"
              className="text-lg font-semibold text-neutral-900"
            >
              Nouveau post
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Planifiez une publication sur vos réseaux.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-neutral-600">
                  Titre
                </span>
                <input
                  required
                  value={form.titre}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, titre: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm outline-none ring-neutral-900/10 focus:ring-2"
                  placeholder="Ex. Reel produit printemps"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-neutral-600">
                    Plateforme
                  </span>
                  <select
                    value={form.plateforme}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, plateforme: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-neutral-900/15"
                  >
                    <option>Instagram</option>
                    <option>TikTok</option>
                    <option>YouTube</option>
                    <option>LinkedIn</option>
                    <option>Facebook</option>
                    <option>X</option>
                    <option>Autre</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-neutral-600">
                    Statut
                  </span>
                  <select
                    value={form.statut}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, statut: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-neutral-900/15"
                  >
                    {EDITORIAL_STATUTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-neutral-600">
                  Date et heure de publication
                </span>
                <input
                  required
                  type="datetime-local"
                  value={form.date_publication}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      date_publication: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-neutral-900/15"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-neutral-600">
                  Contenu / notes
                </span>
                <textarea
                  value={form.contenu}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contenu: e.target.value }))
                  }
                  rows={3}
                  className="mt-1 w-full resize-none rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-neutral-900/15"
                  placeholder="Légende, hooks, liens…"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
                >
                  {submitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
