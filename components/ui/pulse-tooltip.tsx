"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import React from "react";

export function PulseTooltipProvider({
  children,
  delayDuration = 120,
}: {
  children: React.ReactNode;
  delayDuration?: number;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={220}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export const PulseTooltip = TooltipPrimitive.Root;
export const PulseTooltipTrigger = TooltipPrimitive.Trigger;

export function PulseTooltipContent({
  children,
  className = "",
  side = "top",
  align = "center",
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        side={side}
        align={align}
        sideOffset={10}
        className={`z-[220] max-w-[272px] select-none rounded-lg border border-white/[0.09] bg-zinc-950/98 px-3.5 py-2 text-[12px] font-medium leading-snug tracking-tight text-zinc-100 shadow-[0_14px_50px_-10px_rgba(0,0,0,.88),inset_0_1px_0_rgba(255,255,255,.06)] ${className}`}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow
          width={12}
          height={6}
          className="fill-zinc-950"
        />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
