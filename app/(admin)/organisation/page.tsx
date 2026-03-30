"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Kanban, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OrganisationKanban, {
  type KanbanTache,
  normalizeKanbanOrder,
} from "@/components/admin/organisation/OrganisationKanban";
import EditorialCalendar, {
  type EditorialPost,
} from "@/components/admin/organisation/EditorialCalendar";

type Profil = {
  id: string;
  email: string | null;
  role: string | null;
};

export default function OrganisationPage() {
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(true);
  const [taches, setTaches] = useState<KanbanTache[]>([]);
  const [posts, setPosts] = useState<EditorialPost[]>([]);
  const [profiles, setProfiles] = useState<Profil[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [tachesRes, profilesRes, editorialRes] = await Promise.all([
      supabase
        .from("taches")
        .select("id, titre, statut, assigne_a, deadline")
        .order("deadline", { ascending: true, nullsFirst: false }),
      supabase.from("profiles").select("id, email, role"),
      supabase
        .from("editorial_calendar")
        .select("*")
        .order("date_publication", { ascending: true }),
    ]);

    if (tachesRes.error) {
      console.error(tachesRes.error);
    } else {
      setTaches(
        normalizeKanbanOrder((tachesRes.data ?? []) as KanbanTache[])
      );
    }
    if (profilesRes.error) {
      console.error(profilesRes.error);
    } else {
      setProfiles((profilesRes.data ?? []) as Profil[]);
    }
    if (editorialRes.error) {
      console.error(editorialRes.error);
    } else {
      setPosts((editorialRes.data ?? []) as EditorialPost[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const assigneeLabel = useCallback(
    (id: string | null) => {
      if (!id) return "Non assigné";
      const p = profiles.find((x) => x.id === id);
      return p?.email ?? p?.role ?? id.slice(0, 8);
    },
    [profiles]
  );

  const assigneeOptions = useMemo(
    () =>
      profiles
        .filter((p) => (p.role ?? "").toLowerCase() !== "admin")
        .map((p) => ({
          id: p.id,
          label: (p.email ?? p.role ?? "Vendeuse").trim() || "Vendeuse",
        })),
    [profiles]
  );

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] overflow-hidden rounded-[1.75rem] border border-white/40 bg-gradient-to-br from-slate-50/95 via-white to-indigo-50/40 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] md:p-10">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.12),transparent)]"
        aria-hidden
      />
      <div className="relative">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 shadow-md ring-1 ring-black/[0.04] backdrop-blur-md">
              <Kanban className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
                Organisation
              </h1>
              <p className="mt-1 max-w-xl text-sm text-neutral-500">
                Tableau Kanban des tâches et calendrier éditorial — même esprit
                que Notion ou Trello.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-[1.25rem] border border-white/50 bg-white/40 backdrop-blur-md">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm text-neutral-500">Chargement…</p>
          </div>
        ) : (
          <Tabs defaultValue="projet" className="w-full">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="projet">Gestion de projet</TabsTrigger>
              <TabsTrigger value="editorial">Calendrier éditorial</TabsTrigger>
            </TabsList>
            <TabsContent value="projet" className="mt-8">
              <OrganisationKanban
                taches={taches}
                setTaches={setTaches}
                assigneeLabel={assigneeLabel}
                assigneeOptions={assigneeOptions}
              />
            </TabsContent>
            <TabsContent value="editorial" className="mt-8">
              <EditorialCalendar posts={posts} setPosts={setPosts} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
