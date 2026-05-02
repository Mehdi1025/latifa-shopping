"use client";

import { useCallback, useEffect, useRef } from "react";
import { record } from "rrweb";
import type { eventWithTime } from "@rrweb/types";

const MIN_EVENTS_REPLAYABLE = 2;

function subscribeRecorder(onEvent: (ev: eventWithTime) => void): () => void {
  const stop = record({
    emit(ev) {
      onEvent(ev as eventWithTime);
    },
    recordCanvas: false,
    maskInputOptions: { password: true },
    sampling: {
      mousemove: true,
      mouseInteraction: true,
      scroll: 150,
    },
    recordCrossOriginIframes: false,
  });
  if (typeof stop !== "function") {
    return () => {};
  }
  return stop;
}

/**
 * Capture continue de l'écran POS (client uniquement).
 * Appelez consumeReplaySegment() aux moments critiques pour obtenir un segment → Supabase JSONB.
 */
export function useScreenRecorder(enabled: boolean): {
  consumeReplaySegment: () => eventWithTime[] | null;
} {
  const bufferRef = useRef<eventWithTime[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    bufferRef.current = [];
    unsubscribeRef.current?.();
    bufferRef.current = [];
    unsubscribeRef.current = subscribeRecorder((ev) => {
      bufferRef.current.push(ev);
    });

    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      bufferRef.current = [];
    };
  }, [enabled]);

  const consumeReplaySegment = useCallback((): eventWithTime[] | null => {
    if (typeof window === "undefined") return null;
    unsubscribeRef.current?.();

    const segment = [...bufferRef.current];
    bufferRef.current = [];
    unsubscribeRef.current = subscribeRecorder((ev) => {
      bufferRef.current.push(ev);
    });

    return segment.length >= MIN_EVENTS_REPLAYABLE ? segment : null;
  }, []);

  return { consumeReplaySegment };
}
