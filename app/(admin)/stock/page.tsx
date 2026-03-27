import type { Metadata } from "next";
import StockRunway from "@/components/admin/StockRunway";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";

export const metadata: Metadata = {
  title: "Stock Runway — Latifa Shop",
  description: "Prédiction de rupture et vélocité des produits",
};

export default function StockRunwayPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 p-4 md:p-6 lg:p-10">
      <header className="mb-8 lg:mb-10">
        <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-slate-500">
          <Link
            href="/"
            className="transition-colors hover:text-slate-800"
          >
            Accueil
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
          <span className="font-medium text-slate-800">Stock Runway</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 lg:text-3xl">
          Intelligence stock
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Anticipez les ruptures grâce à la vélocité de vente sur 30 jours.
        </p>
      </header>

      <StockRunway />

      <div className="mt-10 rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
              <Package className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Gérer le catalogue</p>
              <p className="text-sm text-slate-500">
                Ajuster les stocks et fiches produits
              </p>
            </div>
          </div>
          <Link
            href="/produits"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            Ouvrir Produits
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
