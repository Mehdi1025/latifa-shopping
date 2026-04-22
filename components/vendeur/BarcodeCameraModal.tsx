"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { X, CameraOff, AlertCircle } from "lucide-react";
import { playScanBeep, playScanErrorBeep } from "@/lib/scan-beep";
import { normalizeEan13String } from "@/lib/produit-import";
import type { Html5Qrcode } from "html5-qrcode";

/** Retourne si l’ajout panier a réussi (bip aigu) ou non (bip grave, toast côté parent). */
export type CameraScanOutcome = "ok" | "err";

type BarcodeCameraModalProps = {
  open: boolean;
  onClose: () => void;
  /** Traitement EAN (panier) — ne doit pas fermer le modal. */
  onEan13: (ean: string) => CameraScanOutcome;
};

const COOLDOWN_MS = 1800;

type PermissionState = "unknown" | "granted" | "denied" | "unavailable";

const SCAN_FPS = 8;

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
  const [frameFlash, setFrameFlash] = useState<"off" | "success" | "error">("off");
  const [cooldownActive, setCooldownActive] = useState(false);
  const cooldownUntilRef = useRef(0);
  const onEan13Ref = useRef(onEan13);
  onEan13Ref.current = onEan13;

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
      void stopScanner();
      setPermission("unknown");
      setStartError(null);
      setFrameFlash("off");
      setCooldownActive(false);
      cooldownUntilRef.current = 0;
      return;
    }

    let cancelled = false;
    setIsStarting(true);
    setStartError(null);
    setFrameFlash("off");
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

      /**
       * iOS / Android : `getCameras()` retourne souvent [] *avant* toute demande
       * d’autorisation. On déclenche d’abord getUserMedia pour obtenir la permission.
       * Si « arrière » échoue, on retente avec une caméra par défaut (certaines ROM).
       */
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
        setFrameFlash("off");

        const outcome = onEan13Ref.current(ean);
        if (outcome === "ok") {
          playScanBeep();
          setFrameFlash("success");
          window.setTimeout(() => setFrameFlash("off"), 450);
        } else {
          playScanErrorBeep();
          setFrameFlash("error");
          window.setTimeout(() => setFrameFlash("off"), 450);
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
        // liste indisponible : on tentera seulement facingMode
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
              "relative min-h-[240px] overflow-hidden rounded-2xl bg-black transition-[box-shadow,ring] duration-200",
              frameFlash === "success" &&
                "ring-4 ring-emerald-400 shadow-[0_0_24px_4px_rgba(52,211,153,0.45)]",
              frameFlash === "error" &&
                "ring-4 ring-red-400 shadow-[0_0_20px_4px_rgba(248,113,113,0.4)]",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div id={regionId} className="min-h-[240px] w-full" />
            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm text-white">
                Démarrage de la caméra…
              </div>
            )}
            {cooldownActive && !isStarting && (
              <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-gray-900/80 px-3 py-1 text-xs font-medium text-white">
                Pause {String(COOLDOWN_MS / 1000).replace(".", ",")}s…
              </div>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-gray-500">
            Scan en rafale : la fenêtre reste ouverte. Placez chaque EAN — bip + cadre
            vert = OK, rouge = erreur.
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
