"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type TeamMember = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
};

function displayName(member: TeamMember): string {
  return member.full_name?.trim() || member.email?.split("@")[0] || "Utilisateur";
}

function roleLabel(role: string | null): string {
  return (role ?? "").trim().toLowerCase() === "admin" ? "Admin" : "Vendeuse";
}

function roleBadgeClass(role: string | null): string {
  return (role ?? "").trim().toLowerCase() === "admin"
    ? "bg-violet-100 text-violet-700"
    : "bg-slate-100 text-slate-600";
}

export default function TeamManagement() {
  const supabase = createSupabaseBrowserClient();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "vendeuse">("vendeuse");
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .order("full_name", { ascending: true, nullsFirst: false });

    if (error) {
      console.error(error);
      toast.error("Impossible de charger l'équipe.");
      setMembers([]);
    } else {
      setMembers((data ?? []) as TeamMember[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);

    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          full_name: inviteName,
          role: inviteRole,
        }),
      });

      const payload = (await res.json()) as { error?: string; message?: string };

      if (!res.ok) {
        toast.error(payload.error ?? "Invitation impossible.");
        return;
      }

      toast.success(payload.message ?? "Invitation envoyée.");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("vendeuse");
      await loadTeam();
    } catch {
      toast.error("Erreur réseau lors de l'invitation.");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (member: TeamMember, role: "admin" | "vendeuse") => {
    if ((member.role ?? "").trim().toLowerCase() === role) return;

    setBusyId(member.id);
    try {
      const res = await fetch(`/api/team/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const payload = (await res.json()) as { error?: string; profile?: TeamMember };

      if (!res.ok) {
        toast.error(payload.error ?? "Modification impossible.");
        return;
      }

      if (payload.profile) {
        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? payload.profile! : m))
        );
      }
      toast.success(`Rôle mis à jour : ${roleLabel(role)}.`);
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (member: TeamMember) => {
    const label = displayName(member);
    if (!window.confirm(`Supprimer l'accès de ${label} ? Cette action est irréversible.`)) {
      return;
    }

    setBusyId(member.id);
    try {
      const res = await fetch(`/api/team/${member.id}`, { method: "DELETE" });
      const payload = (await res.json()) as { error?: string };

      if (!res.ok) {
        toast.error(payload.error ?? "Suppression impossible.");
        return;
      }

      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast.success(`${label} a été retiré de l'équipe.`);
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Users className="h-5 w-5 text-slate-500" />
            Utilisateurs
          </h2>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex h-12 min-h-12 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-all duration-300 ease-in-out hover:bg-slate-50 md:text-base"
          >
            <UserPlus className="h-4 w-4" />
            Inviter
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Chargement de l&apos;équipe…
          </div>
        ) : members.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">
            Aucun membre trouvé. Invitez votre première vendeuse ou un autre admin.
          </p>
        ) : (
          <ul>
            {members.map((member, index) => {
              const isSelf = member.id === currentUserId;
              const isBusy = busyId === member.id;

              return (
                <li
                  key={member.id}
                  className={`flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between ${
                    index < members.length - 1 ? "border-b border-slate-100" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{displayName(member)}</p>
                      {isSelf && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          Vous
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {member.email ?? "E-mail non renseigné"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${roleBadgeClass(member.role)}`}
                    >
                      {roleLabel(member.role)}
                    </span>

                    <select
                      value={(member.role ?? "vendeuse").trim().toLowerCase() === "admin" ? "admin" : "vendeuse"}
                      disabled={isBusy}
                      onChange={(e) =>
                        void handleRoleChange(
                          member,
                          e.target.value as "admin" | "vendeuse"
                        )
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                      aria-label={`Rôle de ${displayName(member)}`}
                    >
                      <option value="vendeuse">Vendeuse</option>
                      <option value="admin">Admin</option>
                    </select>

                    {!isSelf && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleDelete(member)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-100 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        aria-label={`Supprimer ${displayName(member)}`}
                      >
                        {isBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          L&apos;invitation envoie un e-mail Supabase pour définir le mot de passe.
          Configurez{" "}
          <code className="rounded bg-slate-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
          côté serveur pour activer les invitations et suppressions.
        </p>
      </section>

      {inviteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fermer"
            onClick={() => !inviting && setInviteOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="invite-title" className="text-lg font-semibold text-slate-900">
              Inviter un membre
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Un e-mail d&apos;invitation sera envoyé pour créer le mot de passe.
            </p>

            <form onSubmit={(e) => void handleInvite(e)} className="mt-5 space-y-4">
              <div>
                <label htmlFor="invite-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                  E-mail
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="prenom@latifashop.com"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="invite-name" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Nom affiché (optionnel)
                </label>
                <input
                  id="invite-name"
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Prénom"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="invite-role" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Rôle
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as "admin" | "vendeuse")
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="vendeuse">Vendeuse</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={inviting}
                  onClick={() => setInviteOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {inviting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi…
                    </>
                  ) : (
                    "Envoyer l'invitation"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
