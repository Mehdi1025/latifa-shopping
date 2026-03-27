"use client";

import GoalTracker from "@/components/vendeur/GoalTracker";

export default function ObjectifsPage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-b from-slate-50/80 to-slate-100/50 px-4 py-6 dark:from-slate-950 dark:to-slate-900 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-3xl">
            Mes Objectifs
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-white/45">
            Visualisez votre performance du jour et votre progression vers
            l&apos;objectif.
          </p>
        </header>

        <GoalTracker />
      </div>
    </div>
  );
}
