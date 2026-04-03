import { Users, Target, Link2, Smartphone } from "lucide-react";

const utilisateurs = [
  { nom: "Latifa", email: "latifa@latifashop.com", role: "Admin", roleClass: "bg-violet-100 text-violet-700" },
  { nom: "Amina", email: "amina@latifashop.com", role: "Vendeuse", roleClass: "bg-slate-100 text-slate-600" },
  { nom: "Sonia", email: "sonia@latifashop.com", role: "Vendeuse", roleClass: "bg-slate-100 text-slate-600" },
];

const connexions = [
  { nom: "Shopify", connecte: true },
  { nom: "Stripe", connecte: true },
  { nom: "Instagram", connecte: false },
];

export default function ParametresPage() {
  return (
    <div className="admin-container min-h-dvh p-4 sm:p-6 lg:p-8">
      <h1 className="mb-8 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl md:text-3xl">
        Paramètres & Équipe
      </h1>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Users className="h-5 w-5 text-slate-500" />
              Utilisateurs
            </h2>
            <button
              type="button"
              className="flex h-12 min-h-12 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-all duration-300 ease-in-out hover:bg-slate-50 md:text-base"
            >
              + Inviter
            </button>
          </div>
          <ul>
            {utilisateurs.map((user, index) => (
              <li
                key={user.email}
                className={`flex items-center justify-between py-5 ${index < utilisateurs.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <div>
                  <p className="font-medium text-slate-900">{user.nom}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{user.email}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.roleClass}`}
                >
                  {user.role}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-8">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Target className="h-5 w-5 text-slate-500" />
              Objectifs Mensuels
            </h2>
            <form className="space-y-4">
              <div>
                <label
                  htmlFor="objectif-ca"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Objectif CA (€)
                </label>
                <input
                  id="objectif-ca"
                  type="number"
                  defaultValue="15000"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label
                  htmlFor="objectif-commandes"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Objectif Commandes
                </label>
                <input
                  id="objectif-commandes"
                  type="number"
                  defaultValue="400"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                className="mt-2 w-full rounded-md bg-indigo-600 py-2.5 text-sm font-medium text-white transition-all duration-300 ease-in-out hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto sm:px-6"
              >
                Sauvegarder
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Link2 className="h-5 w-5 text-slate-500" />
              Connexions
            </h2>
            <ul className="space-y-4">
              {connexions.map((item) => (
                <li
                  key={item.nom}
                  className="flex items-center justify-between border-b border-slate-100 py-4 last:border-b-0 last:pb-0"
                >
                  <span className="font-medium text-slate-900">{item.nom}</span>
                  {item.connecte ? (
                    <span className="flex items-center gap-2 text-sm text-emerald-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Connecté
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600 transition-all duration-300 ease-in-out hover:bg-slate-100"
                    >
                      Connecter
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Smartphone className="h-5 w-5 text-slate-500" />
          Récap de fin de journée (SMS / WhatsApp)
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Hors périmètre pour l&apos;instant : pour envoyer chaque soir un récap (chiffres du
          jour, tâches, alertes) sur mobile, il faudra brancher un fournisseur type{" "}
          <span className="font-medium">Twilio</span> ou l&apos;API{" "}
          <span className="font-medium">WhatsApp Business</span>, plus une tâche planifiée
          (cron / Edge Function) qui agrège les données et déclenche l&apos;envoi.
        </p>
      </section>
    </div>
  );
}
