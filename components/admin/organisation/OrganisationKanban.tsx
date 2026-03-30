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
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Calendar, GripVertical, Loader2, Plus, User, X } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import {
  TACHE_STATUTS,
  TACHE_STATUT_LABELS,
  normalizeTacheStatut,
  type TacheStatut,
} from "@/lib/tache-statuts";

export type KanbanTache = {
  id: string;
  titre: string;
  statut: string;
  assigne_a: string | null;
  deadline: string | null;
};

export type AssigneeOption = { id: string; label: string };

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [removed] = copy.splice(from, 1);
  copy.splice(to, 0, removed);
  return copy;
}

function formatDeadline(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const COLUMN_META: Record<
  TacheStatut,
  { ring: string; header: string; dot: string }
> = {
  a_faire: {
    ring: "ring-amber-500/20",
    header: "text-amber-800/90",
    dot: "bg-amber-400",
  },
  en_cours: {
    ring: "ring-sky-500/20",
    header: "text-sky-800/90",
    dot: "bg-sky-400",
  },
  termine: {
    ring: "ring-emerald-500/20",
    header: "text-emerald-800/90",
    dot: "bg-emerald-400",
  },
};

function splitColumnsInOrder(taches: KanbanTache[]): Record<TacheStatut, KanbanTache[]> {
  const cols: Record<TacheStatut, KanbanTache[]> = {
    a_faire: [],
    en_cours: [],
    termine: [],
  };
  taches.forEach((t) => {
    const s = normalizeTacheStatut(t.statut);
    cols[s].push({ ...t, statut: s });
  });
  return cols;
}

function mergeColumns(cols: Record<TacheStatut, KanbanTache[]>): KanbanTache[] {
  return [...cols.a_faire, ...cols.en_cours, ...cols.termine];
}

/** Ordre stable des colonnes pour le tableau Kanban. */
export function normalizeKanbanOrder(taches: KanbanTache[]): KanbanTache[] {
  const mapped = taches.map((t) => ({
    ...t,
    statut: normalizeTacheStatut(t.statut),
  }));
  return mergeColumns(splitColumnsInOrder(mapped));
}

export default function OrganisationKanban({
  taches,
  setTaches,
  assigneeLabel,
  assigneeOptions,
}: {
  taches: KanbanTache[];
  setTaches: Dispatch<SetStateAction<KanbanTache[]>>;
  assigneeLabel: (id: string | null) => string;
  assigneeOptions: AssigneeOption[];
}) {
  const supabase = createSupabaseBrowserClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    titre: "",
    assigne_a: "",
    deadline: "",
  });

  const byColumn = useMemo(() => splitColumnsInOrder(taches), [taches]);

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      const destStatut = destination.droppableId as TacheStatut;
      const srcStatut = source.droppableId as TacheStatut;

      let rollback: KanbanTache[] = [];

      setTaches((prev) => {
        rollback = prev;
        const cols = splitColumnsInOrder(prev);
        if (srcStatut === destStatut) {
          cols[srcStatut] = arrayMove(
            cols[srcStatut],
            source.index,
            destination.index
          );
        } else {
          const colSrc = [...cols[srcStatut]];
          const [removed] = colSrc.splice(source.index, 1);
          if (!removed) return prev;
          cols[srcStatut] = colSrc;
          const colDest = [...cols[destStatut]];
          colDest.splice(destination.index, 0, {
            ...removed,
            statut: destStatut,
          });
          cols[destStatut] = colDest;
        }
        return mergeColumns(cols);
      });

      if (srcStatut === destStatut) return;

      setUpdatingId(draggableId);
      const { error } = await supabase
        .from("taches")
        .update({ statut: destStatut })
        .eq("id", draggableId);

      if (error) {
        setTaches(rollback);
        toast.error("Impossible de mettre à jour le statut", {
          description: error.message,
        });
      }
      setUpdatingId(null);
    },
    [supabase, setTaches]
  );

  const openModal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setForm({
      titre: "",
      assigne_a: "",
      deadline: d.toISOString().slice(0, 16),
    });
    setModalOpen(true);
  };

  const submitNew = async (e: FormEvent) => {
    e.preventDefault();
    const titre = form.titre.trim();
    if (!titre) {
      toast.error("Indiquez un titre");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("taches")
      .insert({
        titre,
        assigne_a: form.assigne_a || null,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        statut: "a_faire",
        description: null,
      })
      .select("id, titre, statut, assigne_a, deadline")
      .single();

    setSubmitting(false);
    if (error) {
      toast.error("Création impossible", { description: error.message });
      return;
    }
    const row = data as KanbanTache;
    setTaches((prev) => normalizeKanbanOrder([...prev, row]));
    toast.success("Tâche créée");
    setModalOpen(false);
  };

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-neutral-900/15 transition hover:bg-neutral-800"
        >
          <Plus className="h-4 w-4" />
          Nouvelle tâche
        </button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
          {TACHE_STATUTS.map((colId) => (
            <Droppable droppableId={colId} key={colId}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex min-h-[min(70vh,520px)] flex-col rounded-[1.25rem] border border-white/40 bg-white/45 p-4 shadow-[0_8px_40px_-20px_rgba(0,0,0,0.12)] ring-1 backdrop-blur-xl transition-colors ${
                    COLUMN_META[colId].ring
                  } ${snapshot.isDraggingOver ? "bg-white/70" : ""}`}
                >
                  <div className="mb-4 flex items-center justify-between gap-2 px-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${COLUMN_META[colId].dot}`}
                      />
                      <h3
                        className={`text-xs font-semibold uppercase tracking-[0.2em] ${COLUMN_META[colId].header}`}
                      >
                        {TACHE_STATUT_LABELS[colId]}
                      </h3>
                    </div>
                    <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium tabular-nums text-neutral-600">
                      {byColumn[colId].length}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-0.5">
                    {byColumn[colId].map((tache, index) => (
                      <Draggable
                        key={tache.id}
                        draggableId={tache.id}
                        index={index}
                        isDragDisabled={updatingId === tache.id}
                      >
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={`rounded-2xl border border-white/50 bg-white/80 p-4 shadow-sm ring-1 ring-black/[0.03] transition-shadow ${
                              dragSnapshot.isDragging
                                ? "shadow-lg ring-2 ring-neutral-900/10"
                                : "hover:shadow-md"
                            }`}
                          >
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="mt-0.5 cursor-grab text-neutral-300 hover:text-neutral-500 active:cursor-grabbing"
                                aria-label="Déplacer"
                                {...dragProvided.dragHandleProps}
                              >
                                <GripVertical className="h-4 w-4" />
                              </button>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold leading-snug text-neutral-900">
                                  {tache.titre}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-500">
                                  <span className="flex items-center gap-1">
                                    <User className="h-3.5 w-3.5" />
                                    {assigneeLabel(tache.assigne_a)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {formatDeadline(tache.deadline)}
                                  </span>
                                </div>
                              </div>
                              {updatingId === tache.id && (
                                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-400" />
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kanban-new-task-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            aria-label="Fermer"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/50 bg-white/95 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <h2
                id="kanban-new-task-title"
                className="text-lg font-semibold text-neutral-900"
              >
                Nouvelle tâche
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={submitNew} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-neutral-600">
                  Titre
                </span>
                <input
                  required
                  autoFocus
                  value={form.titre}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, titre: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-neutral-900/15"
                  placeholder="Titre de la tâche"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-neutral-600">
                  Vendeuse assignée
                </span>
                <select
                  value={form.assigne_a}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, assigne_a: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-neutral-900/15"
                >
                  <option value="">Non assigné</option>
                  {assigneeOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-neutral-600">
                  Date d&apos;échéance
                </span>
                <input
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, deadline: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-neutral-900/15"
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
                  className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
