import KPICard from "@/components/KPICard";
import SalesChart from "@/components/SalesChart";

export default function KPIPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-10">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Indicateurs Clés (KPI)
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Performances d&apos;aujourd&apos;hui
        </p>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title="Chiffre d'affaires"
          value="1 450 €"
          trend="↑ 12%"
          trendPositive
          fromLabel="hier"
        />
        <KPICard
          title="Commandes Web"
          value="34"
          trend="↑ 8%"
          trendPositive
          fromLabel="hier"
        />
        <KPICard
          title="Panier moyen"
          value="42,60 €"
          trend="↓ 2%"
          trendPositive={false}
          fromLabel="hier"
        />
        <KPICard
          title="Visiteurs"
          value="840"
          trend="↑ 18%"
          trendPositive
          fromLabel="TikTok"
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 transition-all duration-300 ease-in-out hover:shadow-lg">
        <h2 className="mb-6 text-base font-semibold text-slate-900">
          Évolution du CA (7 derniers jours)
        </h2>
        <SalesChart />
      </section>
    </div>
  );
}
