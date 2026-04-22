"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, CameraOff, AlertCircle } from "lucide-react";
import { playScanBeep, playScanErrorBeep } from "@/lib/scan-beep";
import { normalizeEan13String } from "@/lib/produit-import";
import type { Html5Qrcode } from "html5-qrcode";

const FLASH_MS = 400;
const GIANT_ANIM_S = 1;
const GIANT_CLEAR_MS = Math.round(GIANT_ANIM_S * 1000) + 100;
const MAX_HISTORY = 4;
const COOLDOWN_MS = 1800;

export type CameraScanResult =
  | { ok: true; productLabel: string }
  | { ok: false };

type BarcodeCameraModalProps = {
  open: boolean;
  onClose: () => void;
  onEan13: (ean: string) => CameraScanResult;
};

type PermissionState = "unknown" | "granted" | "denied" | "unavailable";

type ScannedLine = { at: number; label: string };

const SCAN_FPS = 8;

function formatHeureCaisse(ts: number): string {
  return new Date(ts).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function BarcodeCameraModal({
  open,
  onClose,
  onEan13,
}: BarcodeCameraModalProps) {
  const reactId = useId();
  const regionId = `barcode-caisse-${reactId.replace(/:/g, "")}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastCodeRef = useRef<string>("");
  const lastTimeRef = useRef<number>(0);
  const [permission, setPermission] = useState<PermissionState>("unknown");
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  /** Flash périphérique (vision latérale) : vert = succès, rouge = erreur */
  const [scanFlash, setScanFlash] = useState<"off" | "success" | "error">("off");
  const [cooldownActive, setCooldownActive] = useState(false);
  const cooldownUntilRef = useRef(0);
  const onEan13Ref = useRef(onEan13);
  onEan13Ref.current = onEan13;

  const [giantPulse, setGiantPulse] = useState<{
    key: number;
    text: string;
  } | null>(null);
  const giantClearRef = useRef<number | null>(null);
  const [lastScannedItems, setLastScannedItems] = useState<ScannedLine[]>([]);

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        if (s.isScanning) await s.stop();
        s.clear();
      } catch {
        // déjà arrêté
      }
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setScanFlash("off");
      setGiantPulse(null);
      setLastScannedItems([]);
      if (giantClearRef.current) {
        clearTimeout(giantClearRef.current);
        giantClearRef.current = null;
      }
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      void stopScanner();
      setPermission("unknown");
      setStartError(null);
      setScanFlash("off");
      setCooldownActive(false);
      cooldownUntilRef.current = 0;
      return;
    }

    let cancelled = false;
    setIsStarting(true);
    setStartError(null);
    setScanFlash("off");
    cooldownUntilRef.current = 0;
    setCooldownActive(false);

    (async () => {
      if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
        setPermission("unavailable");
        setStartError("Caméra indisponible (HTTPS requis sur mobile).");
        setIsStarting(false);
        return;
      }

      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

      let permissionOk = false;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        stream.getTracks().forEach((t) => t.stop());
        permissionOk = true;
      } catch {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          stream.getTracks().forEach((t) => t.stop());
          permissionOk = true;
        } catch {
          permissionOk = false;
        }
      }
      if (!permissionOk) {
        if (cancelled) return;
        setPermission("denied");
        setIsStarting(false);
        return;
      }

      if (cancelled) return;

      const onSuccess = (decodedText: string) => {
        const now = Date.now();
        if (now < cooldownUntilRef.current) return;

        const ean = normalizeEan13String(decodedText.replace(/\s/g, ""));
        if (!ean) return;
        if (ean === lastCodeRef.current && now - lastTimeRef.current < 400) {
          return;
        }
        lastCodeRef.current = ean;
        lastTimeRef.current = now;

        cooldownUntilRef.current = now + COOLDOWN_MS;
        setCooldownActive(true);
        setScanFlash("off");

        const result = onEan13Ref.current(ean);
        if (result.ok) {
          playScanBeep();
          setScanFlash("success");
          window.setTimeout(() => {
            setScanFlash((f) => (f === "success" ? "off" : f));
          }, FLASH_MS);
          if (giantClearRef.current) clearTimeout(giantClearRef.current);
          setGiantPulse((p) => ({
            key: (p?.key ?? 0) + 1,
            text: result.productLabel,
          }));
          giantClearRef.current = window.setTimeout(() => {
            setGiantPulse(null);
            giantClearRef.current = null;
          }, GIANT_CLEAR_MS);
          setLastScannedItems((prev) =>
            [{ at: now, label: result.productLabel }, ...prev].slice(0, MAX_HISTORY)
          );
        } else {
          playScanErrorBeep();
          setScanFlash("error");
          window.setTimeout(() => {
            setScanFlash((f) => (f === "error" ? "off" : f));
          }, FLASH_MS);
        }

        window.setTimeout(() => {
          cooldownUntilRef.current = 0;
          setCooldownActive(false);
        }, COOLDOWN_MS);
      };

      const onError = () => {
        // frame sans code : normal
      };

      const qrbox = (w: number, h: number) => {
        const size = Math.max(120, Math.min(280, Math.floor(Math.min(w, h) * 0.72)));
        return { width: size, height: Math.floor(size * 0.42) };
      };

      const makeScanner = (useBarcodeDetector: boolean) =>
        new Html5Qrcode(regionId, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
          ],
          useBarCodeDetectorIfSupported: useBarcodeDetector,
        });

      const tryStart = async (scanner: Html5Qrcode, camera: string | MediaTrackConstraints) => {
        await scanner.start(
          camera,
          {
            fps: SCAN_FPS,
            aspectRatio: 1.333,
            qrbox,
          },
          onSuccess,
          onError
        );
      };

      let scanner = makeScanner(true);
      scannerRef.current = scanner;

      const cameraAttempts: (string | MediaTrackConstraints)[] = [];

      try {
        const cams = await Html5Qrcode.getCameras();
        const back = cams.find(
          (c) =>
            /back|rear|arrière|environment|ultra\s*wide/i.test(c.label) ||
            /camera 0|caméra 0/i.test(c.label)
        );
        if (cams.length > 0) {
          if (back) cameraAttempts.push(back.id);
          for (const c of cams) {
            if (!back || c.id !== back.id) cameraAttempts.push(c.id);
          }
        }
      } catch {
        // liste indisponible
      }

      cameraAttempts.push(
        { facingMode: { ideal: "environment" } },
        { facingMode: { ideal: "user" } },
        { facingMode: "environment" } as MediaTrackConstraints,
        { facingMode: "user" } as MediaTrackConstraints
      );

      let lastStartErr: Error | null = null;
      for (const camera of cameraAttempts) {
        if (cancelled) return;
        try {
          if (!scannerRef.current) {
            scanner = makeScanner(true);
            scannerRef.current = scanner;
          } else {
            scanner = scannerRef.current;
          }
          await tryStart(scanner, camera);
          lastStartErr = null;
          break;
        } catch (e) {
          lastStartErr = e instanceof Error ? e : new Error(String(e));
          try {
            if (scanner.isScanning) await scanner.stop();
            scanner.clear();
          } catch {
            // ignore
          }
          scannerRef.current = null;
          scanner = makeScanner(true);
          scannerRef.current = scanner;
        }
      }

      if (lastStartErr && !cancelled) {
        const scanner2 = makeScanner(false);
        scannerRef.current = scanner2;
        try {
          await tryStart(scanner2, { facingMode: { ideal: "environment" } });
          lastStartErr = null;
        } catch (e) {
          lastStartErr = e instanceof Error ? e : new Error(String(e));
          try {
            if (scanner2.isScanning) await scanner2.stop();
            scanner2.clear();
          } catch {
            // ignore
          }
          const msg = lastStartErr.message;
          if (/NotAllowed|Permission|denied|NotFound/i.test(msg)) {
            setPermission("denied");
          } else {
            setStartError(
              "Impossible d’ouvrir la caméra. Sur iPhone, utilisez Safari et l’icône « aA » > « site web » autorisant la caméra, ou saisissez l’EAN manuellement."
            );
          }
          setIsStarting(false);
          return;
        }
      }

      if (cancelled) {
        void stopScanner();
        return;
      }

      setPermission("granted");
      setIsStarting(false);
    })().catch(() => {
      if (!cancelled) {
        setStartError("Erreur au démarrage du scan. Réessayez ou saisissez l’EAN à la main.");
        setIsStarting(false);
      }
    });

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [open, regionId, stopScanner]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4"
      data-skip-ean-capture
      role="dialog"
      aria-modal="true"
      aria-label="Scanner un code-barres"
    >
      <div className="pointer-events-none absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-gray-200">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">📷 Scanner EAN-13</h2>
          <button
            type="button"
            onClick={() => {
              void stopScanner();
              onClose();
            }}
            className="flex h-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl text-gray-500 transition hover:bg-gray-100"
            aria-label="Fermer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-3 pb-4">
          {permission === "denied" && (
            <div className="mb-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                Accès refusé ou caméra indisponible. Sur iOS : Réglages → Safari (ou le navigateur
                utilisé) → Caméra, ou autorisez le site en appuyant sur <strong>« aA »</strong> à
                gauche de la barre d’adresse, puis Saisir l’EAN au clavier.
              </p>
            </div>
          )}
          {permission === "unavailable" && !startError && (
            <div className="mb-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <CameraOff className="mt-0.5 h-5 w-5 shrink-0" />
              <p>Caméra indisponible. Ouvrez l’app en HTTPS ou saisissez l’EAN manuellement.</p>
            </div>
          )}
          {startError && (
            <div className="mb-3 flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-3 text-sm text-red-800 ring-1 ring-red-100">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{startError}</p>
            </div>
          )}

          <div
            className={[
              "relative min-h-[260px] overflow-hidden rounded-2xl bg-black transition-shadow duration-150",
              scanFlash === "off" && "ring-0",
              scanFlash === "success" && "ring-[5px] ring-green-500 shadow-[0_0_32px_8px_rgba(34,197,94,0.6)]",
              scanFlash === "error" && "ring-[5px] ring-red-500 shadow-[0_0_28px_8px_rgba(248,113,113,0.55)]",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div id={regionId} className="min-h-[260px] w-full" />

            {scanFlash === "success" && (
              <div
                className="pointer-events-none absolute inset-0 z-[2] rounded-2xl bg-green-500/30"
                aria-hidden
              />
            )}
            {scanFlash === "error" && (
              <div
                className="pointer-events-none absolute inset-0 z-[2] rounded-2xl bg-red-500/30"
                aria-hidden
              />
            )}

            {lastScannedItems.length > 0 && !isStarting && (
              <div
                className="pointer-events-none absolute left-2 top-2 z-[15] max-w-[min(100%,12rem)] rounded-xl border border-white/20 bg-black/60 px-2.5 py-2 text-[10px] leading-tight text-white shadow-lg backdrop-blur-sm sm:max-w-[14rem] sm:text-[11px]"
                aria-live="polite"
                aria-label="Derniers articles scannés"
              >
                <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white/80">
                  Derniers scans
                </p>
                <ul className="space-y-1">
                  {lastScannedItems.map((row) => (
                    <li key={`${row.at}-${row.label}`} className="text-white/95">
                      <span className="font-mono text-white/70">{formatHeureCaisse(row.at)}</span>
                      <span className="text-white/50"> — </span>
                      <span className="font-medium [overflow-wrap:anywhere]">{row.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <AnimatePresence>
              {giantPulse && !isStarting && (
                <motion.div
                  key={giantPulse.key}
                  className="pointer-events-none absolute inset-0 z-[30] flex items-center justify-center p-2 sm:p-4"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="max-h-[80%] max-w-full overflow-hidden px-1 text-center [overflow-wrap:anywhere]"
                    initial={{ scale: 0.4, opacity: 0, y: 0 }}
                    animate={{
                      scale: [0.4, 1, 1],
                      opacity: [0, 1, 0],
                      y: [0, 0, -0.22 * 260],
                    }}
                    transition={{
                      duration: GIANT_ANIM_S,
                      times: [0, 0.2, 1],
                      ease: ["easeOut", "linear", "easeIn"],
                    }}
                  >
                    <p
                      className="text-2xl font-extrabold leading-[1.12] text-white sm:text-3xl sm:leading-tight md:text-4xl"
                      style={{
                        textShadow:
                          "0 0 1px #000, 0 2px 4px #000, 0 4px 16px #000, 0 0 32px #000",
                      }}
                    >
                      {giantPulse.text}
                    </p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {isStarting && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 text-sm text-white">
                Démarrage de la caméra…
              </div>
            )}
            {cooldownActive && !isStarting && (
              <div className="pointer-events-none absolute bottom-2 left-1/2 z-[20] -translate-x-1/2 rounded-full bg-gray-900/80 px-3 py-1 text-xs font-medium text-white">
                Pause {String(COOLDOWN_MS / 1000).replace(".", ",")}s…
              </div>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-gray-500">
            Scan en rafale : vert + texte = OK, rouge = erreur. Fermer avec le bouton ci-dessous.
          </p>
          <button
            type="button"
            onClick={() => {
              void stopScanner();
              onClose();
            }}
            className="mt-4 flex min-h-14 w-full items-center justify-center rounded-2xl bg-gray-900 py-3.5 text-base font-bold text-white shadow-md transition active:scale-[0.99] hover:bg-gray-800"
          >
            Terminer le scan
          </button>
        </div>
      </div>
    </div>
  );
}
