"use client";

import { Search, ChevronDown } from "lucide-react";

const users = [
  { name: "Latifa B.", email: "latifa@latifashop.com", role: "Admin", status: "Actif", avatar: "L" },
  { name: "Amina K.", email: "amina@latifashop.com", role: "Vendeuse", status: "Actif", avatar: "A" },
  { name: "Sonia M.", email: "sonia@latifashop.com", role: "Vendeuse", status: "Actif", avatar: "S" },
  { name: "Aïcha T.", email: "aicha@latifashop.com", role: "Vendeuse", status: "En attente", avatar: "A" },
];

export default function UsersTableCard() {
  return (
    <section className="animate-fade-in-up rounded-xl border border-slate-200 bg-white opacity-0 p-6" style={{ animationDelay: "0.3s", animationFillMode: "forwards" }}>
      <div className="mb-6 flex flex-col gap-4">
        <h3 className="text-base font-semibold tracking-tight text-slate-900">
          Utilisateurs
        </h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-all duration-300 ease-in-out hover:bg-slate-50 sm:w-auto"
          >
            Statut : Tous
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-all duration-300 ease-in-out hover:bg-slate-50 sm:w-auto"
          >
            Inscription : Tous
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          </button>
          <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Rechercher des utilisateurs..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Utilisateur
              </th>
              <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Rôle
              </th>
              <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Statut
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.email}
                className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/50"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white shadow-sm">
                      {user.avatar}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {user.role}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      user.status === "Actif"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
