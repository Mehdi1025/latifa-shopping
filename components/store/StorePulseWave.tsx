"use client";

import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import {
  PulseTooltip,
  PulseTooltipContent,
  PulseTooltipProvider,
  PulseTooltipTrigger,
} from "@/components/ui/pulse-tooltip";
import {
  pulseBarVisualHeight,
  type StorePulseWaveEntry,
  type StorePulseWaveKind,
} from "@/lib/storePulse";

function barStyles(kind: StorePulseWaveKind): string {
  switch (kind) {
    case "scan":
      return "bg-[#b8bfd1] shadow-inner ring-1 ring-white/10 hover:bg-[#c9d2e8]";
    case "encaissement":
      return [
        "bg-emerald-400",
        "shadow-[0_0_22px_-2px_rgba(52,211,153,.9),inset_0_1px_0_rgba(255,255,255,.42)]",
        "ring-[0.5px] ring-emerald-200/50",
        "hover:bg-emerald-300",
      ].join(" ");
    case "annulation":
    case "anomalie":
      return [
        "bg-red-500",
        "shadow-[0_0_26px_-1px_rgba(248,113,113,.92),0_0_54px_-8px_rgba(239,68,68,.65)]",
        "ring-[0.5px] ring-red-300/55",
        "hover:bg-red-400",
      ].join(" ");
    default:
      return "";
  }
}

export type StorePulseWaveProps = {
  entries: StorePulseWaveEntry[];
  /** Étiquette en coin (ex. démo ou filtre temps réel). */
  sourceBadge?: string;
  className?: string;
  onBarActivate?: (entry: StorePulseWaveEntry) => void;
};

export function StorePulseWave({
  entries,
  sourceBadge = "Live",
  className = "",
  onBarActivate,
}: StorePulseWaveProps) {
  return (
    <section
      className={`relative overflow-hidden rounded-[1.65rem] border border-white/[0.06] bg-gradient-to-br from-[#090b13] via-[#0f111c] to-[#05060a] px-6 py-8 shadow-[0_48px_100px_-40px_rgba(0,0,0,.75),inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-2xl md:py-10 ${className}`}
      aria-label="Store Pulse — onde d’activité caisse"
    >
      {/* Glass sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,.09),transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,.035),transparent_32%,transparent_68%,rgba(0,0,0,.42))]"
      />

      <div className="relative mx-auto mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-200/95 ring-1 ring-white/[0.08] backdrop-blur-sm">
            <Activity className="size-3.5 text-emerald-300" strokeWidth={2.25} aria-hidden />
            Store Pulse
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-white md:text-xl">
            Activité depuis l&apos;ouverture
          </h2>
          <p className="max-w-lg text-[13px] leading-relaxed text-slate-400">
            Une lecture instantanée des scans, encaissements et incidents — même logique sonore que
            la timeline sonore&nbsp;: calme puis pics.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300 ring-1 ring-white/[0.07]">
            {sourceBadge}
          </span>
        </div>
      </div>

      <PulseTooltipProvider>
        {/* Grille sous la vague */}
        <div className="relative mx-auto rounded-2xl border border-white/[0.05] bg-black/25 px-3 py-5 shadow-inner md:py-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-10 bottom-14 top-14 bg-[linear-gradient(to_right,rgba(52,211,153,.078)_1px,transparent_1px)] opacity-65 [background-size:28px_100%]"
          />
          <motion.div
            className="relative flex max-h-[9.75rem] min-h-[9rem] flex-nowrap items-end justify-start gap-[3px] overflow-x-auto pb-6 pt-2 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.2)_transparent] md:gap-[3.5px] md:justify-center lg:justify-between"
            style={{ scrollbarGutter: "stable" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            {entries.map((entry, index) => (
              <PulseTooltip key={entry.id}>
                <PulseTooltipTrigger asChild>
                  <motion.button
                    type="button"
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{
                      delay: 0.07 + index * 0.018,
                      duration: 0.36,
                      ease: [0.22, 1, 0.36, 1] as const,
                    }}
                    className={`relative shrink-0 cursor-pointer rounded-full outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-indigo-400/95 ${barStyles(entry.kind)}`}
                    style={{
                      transformOrigin: "50% 100%",
                      width: 4,
                      height: pulseBarVisualHeight(entry.kind, entry.amountEUR),
                    }}
                    whileHover={{
                      scaleY: 1.28,
                      opacity: 0.94,
                      transition: { type: "spring", stiffness: 520, damping: 28 },
                    }}
                    whileTap={{
                      scaleY: 0.92,
                      transition: { type: "spring", stiffness: 600, damping: 32 },
                    }}
                    onClick={() => onBarActivate?.(entry)}
                    aria-label={`${entry.ariaAction} — ouvrir le VAR`}
                  />
                </PulseTooltipTrigger>
                <PulseTooltipContent side="top">
                  <span className="font-semibold text-white">{entry.labelShort}</span>
                </PulseTooltipContent>
              </PulseTooltip>
            ))}
          </motion.div>
        </div>
      </PulseTooltipProvider>

      <footer className="relative mt-5 flex flex-wrap items-center gap-4 gap-y-3 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
        <LegendDot className="bg-[#c5ccdd]" />
        Scan
        <LegendDot className="bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.85)] ring-2 ring-black/55" />
        Encaissement
        <LegendDot className="bg-red-500 shadow-[0_0_14px_rgba(248,113,113,.9)] ring-2 ring-black/55" />
        Annulation&nbsp;/&nbsp;anomalie
      </footer>
    </section>
  );
}

function LegendDot({ className }: { className: string }) {
  return (
    <span
      className={`inline-block size-[7px] rounded-full ${className}`}
      aria-hidden
    />
  );
}
