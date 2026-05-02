"use client";

import { useEffect, useRef } from "react";
import type { eventWithTime } from "@rrweb/types";

type Props = {
  events: eventWithTime[];
  className?: string;
};

/**
 * Wrapper client rrweb-player (import dynamique uniquement après montage pour éviter le SSR Next).
 */
export function RrwebSessionPlayer({ events, className = "" }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<unknown>(null);

  useEffect(() => {
    if (!hostRef.current || events.length < 2) return;

    let cancelled = false;

    void (async () => {
      await import("rrweb-player/dist/style.css");
      const mod = await import("rrweb-player");
      const RPlayer = mod.default;

      if (cancelled || !hostRef.current) return;

      try {
        (playerRef.current as { $destroy?: () => void } | null)?.$destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      hostRef.current.innerHTML = "";

      const w = Math.min(960, Math.max(320, hostRef.current.clientWidth || 960));
      const h = Math.round((w / 16) * 9);

      playerRef.current = new RPlayer({
        target: hostRef.current,
        props: {
          events,
          width: w,
          height: h,
          autoPlay: false,
          showController: true,
          speed: 1,
          maxScale: 1,
        },
      });
    })();

    return () => {
      cancelled = true;
      try {
        (playerRef.current as { $destroy?: () => void } | null)?.$destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, [events]);

  if (events.length < 2) {
    return (
      <div
        className={`flex min-h-[200px] items-center justify-center rounded-xl border border-amber-200/90 bg-amber-50 px-6 py-12 text-center text-sm text-amber-900 ${className}`}
      >
        Replay indisponible : pas assez d&apos;événements enregistrés pour cette action.
      </div>
    );
  }

  return (
    <div
      className={`rrweb-session-player relative w-full overflow-hidden rounded-xl border border-slate-800 bg-black shadow-[0_20px_50px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/10 ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <div
        ref={hostRef}
        className="min-h-[200px] w-full [&_.replayer-wrapper]:rounded-xl [&_.rr-controller]:shrink-0"
      />
    </div>
  );
}
