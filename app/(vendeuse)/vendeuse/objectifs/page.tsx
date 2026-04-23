"use client";

import GoalTracker from "@/components/vendeur/GoalTracker";

export default function ObjectifsPage() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-gradient-to-b from-slate-50/80 to-slate-100/50 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto flex w-full min-h-0 max-w-2xl flex-1 flex-col px-4 py-6 pb-8 max-md:min-h-[calc(100dvh-9rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] md:max-w-3xl md:px-8 md:py-8 md:pb-10 lg:max-w-4xl lg:px-10 lg:py-10">
        <header className="mb-6 shrink-0 md:mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-3xl lg:text-[2rem]">
            Mes Objectifs
          </h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-500 dark:text-white/45 md:text-base">
            Visualisez votre performance du jour et votre progression vers
            l&apos;objectif.
          </p>
        </header>

        <div className="min-h-0 w-full flex-1 pb-[env(safe-area-inset-bottom,0px)]">
          <GoalTracker />
        </div>
      </div>
    </div>
  );
}
