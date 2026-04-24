import { type MutableRefObject, type RefObject, useEffect } from "react";

const BUFFER_FLUSH_MS = 50;

type Opts = {
  inputRef: RefObject<HTMLInputElement | null>;
  /** Ex. modales ouvertes : pas de capture clavier globale. */
  blocked: boolean;
  onEan13Ref: MutableRefObject<(ean: string) => void>;
};

/**
 * Douchette (keyboard wedge) : tampon 13 chiffres + Enter, hors champs texte
 * (sauf la barre liée à `inputRef`, gérée par le champ).
 */
export function useWedgeEan13Listener({
  inputRef,
  blocked,
  onEan13Ref,
}: Opts) {
  useEffect(() => {
    let buf = "";
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const clearFlushTimer = () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
    };

    const scheduleBufferFlush = () => {
      clearFlushTimer();
      flushTimer = setTimeout(() => {
        buf = "";
        flushTimer = null;
      }, BUFFER_FLUSH_MS);
    };

    const wedgeDigitFromEvent = (e: KeyboardEvent): string | null => {
      if (e.key.length === 1 && e.key >= "0" && e.key <= "9") return e.key;
      const c = e.code;
      if (/^Digit[0-9]$/.test(c)) return c.slice(-1);
      if (/^Numpad[0-9]$/.test(c)) return c.slice(-1);
      return null;
    };

    const isTypingInField = (el: EventTarget | null): boolean => {
      if (!el || !(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      const t = el.tagName;
      return t === "INPUT" || t === "TEXTAREA" || t === "SELECT";
    };

    const onKey = (e: KeyboardEvent) => {
      if (blocked) return;
      if (e.isComposing) return;

      const fromSkip = (e.target as HTMLElement | null)?.closest?.(
        "[data-skip-ean-capture]"
      );
      if (fromSkip) return;

      if (e.ctrlKey || e.altKey || e.metaKey) {
        buf = "";
        clearFlushTimer();
        return;
      }

      const ae = document.activeElement;
      if (ae === inputRef.current) return;
      if (isTypingInField(ae)) return;

      if (e.key === "Enter") {
        if (buf.length === 13 && /^\d{13}$/.test(buf)) {
          e.preventDefault();
          onEan13Ref.current(buf);
        } else if (buf.length > 0) {
          e.preventDefault();
        }
        buf = "";
        clearFlushTimer();
        return;
      }

      const digit = wedgeDigitFromEvent(e);
      if (digit !== null) {
        if (e.repeat) return;
        clearFlushTimer();
        buf = (buf + digit).slice(-20);
        scheduleBufferFlush();
        return;
      }

      buf = "";
      clearFlushTimer();
    };

    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      clearFlushTimer();
    };
  }, [blocked, inputRef, onEan13Ref]);
}
