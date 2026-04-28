import { type MutableRefObject, type RefObject, useEffect } from "react";
import { toast } from "sonner";

const BUFFER_FLUSH_MS = 150;

/**
 * Retire tout sauf les chiffres ; accepte EAN-13 ou UPC-A (12 chiffres → préfixe 0).
 */
function normalizeWedgeEanBuffer(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && /^\d{13}$/.test(digits)) return digits;
  if (digits.length === 12 && /^\d{12}$/.test(digits)) return `0${digits}`;
  return null;
}

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
      console.log("Touche reçue:", e.key, "Code:", e.code, "Buffer actuel:", buf);

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

      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        return;
      }

      if (e.key === "Enter") {
        const ean = normalizeWedgeEanBuffer(buf);
        if (ean) {
          e.preventDefault();
          onEan13Ref.current(ean);
        } else if (buf.length > 0) {
          e.preventDefault();
          toast.error(`Scan rejeté: ${buf}`);
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
