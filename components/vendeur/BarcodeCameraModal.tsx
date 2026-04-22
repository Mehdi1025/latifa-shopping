"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { X, CameraOff, AlertCircle } from "lucide-react";
import { playScanBeep } from "@/lib/scan-beep";
import { normalizeEan13String } from "@/lib/produit-import";
import type { Html5Qrcode } from "html5-qrcode";

type BarcodeCameraModalProps = {
  open: boolean;
  onClose: () => void;
  /** EAN-13 normalisé (13 chiffres) — appelé après arrêt caméra + bip, puis fermeture. */
  onEan13: (ean: string) => void;
};

type PermissionState = "unknown" | "granted" | "denied" | "unavailable";

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
  const processingRef = useRef(false);

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
      processingRef.current = false;
      return;
    }

    let cancelled = false;
    setIsStarting(true);
    setStartError(null);
    processingRef.current = false;

    (async () => {
      if (typeof window === "undefined" || !navigator?.mediaDevices) {
        setPermission("unavailable");
        setStartError("Caméra indisponible sur cet appareil.");
        setIsStarting(false);
        return;
      }

      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

      let devices: Awaited<ReturnType<typeof Html5Qrcode.getCameras>>;
      try {
        devices = await Html5Qrcode.getCameras();
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (/NotAllowed|Permission|denied/i.test(msg)) {
          setPermission("denied");
        } else {
          setStartError("Impossible d’accéder à la caméra. Utilisez la saisie manuelle.");
        }
        setIsStarting(false);
        return;
      }

      if (cancelled) return;
      if (!devices?.length) {
        setPermission("unavailable");
        setStartError("Aucune caméra détectée. Utilisez le champ de recherche.");
        setIsStarting(false);
        return;
      }

      setPermission("granted");
      const scanner = new Html5Qrcode(regionId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
        ],
        useBarCodeDetectorIfSupported: true,
      });
      scannerRef.current = scanner;

      const onSuccess = (decodedText: string) => {
        if (processingRef.current) return;
        const ean = normalizeEan13String(decodedText.replace(/\s/g, ""));
        if (!ean) return;
        const now = Date.now();
        if (ean === lastCodeRef.current && now - lastTimeRef.current < 1500) return;
        lastCodeRef.current = ean;
        lastTimeRef.current = now;
        processingRef.current = true;

        void (async () => {
          playScanBeep();
          try {
            await stopScanner();
          } finally {
            onClose();
            onEan13(ean);
            processingRef.current = false;
          }
        })();
      };

      const onError = () => {
        // scans échoués: normal, pas d’action
      };

      const camConfig: MediaTrackConstraints = { facingMode: { ideal: "environment" } };

      try {
        await scanner.start(
          camConfig,
          {
            fps: 8,
            aspectRatio: 1.333,
            qrbox: (w, h) => {
              const size = Math.min(280, Math.floor(Math.min(w, h) * 0.72));
              return { width: size, height: Math.floor(size * 0.42) };
            },
          },
          onSuccess,
          onError
        );
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (/NotAllowed|Permission|denied/i.test(msg)) {
          setPermission("denied");
        } else {
          setStartError("Impossible de démarrer la caméra. Essayez le champ de saisie.");
        }
        setIsStarting(false);
        return;
      }

      if (cancelled) {
        void stopScanner();
        return;
      }
      setIsStarting(false);
    })().catch(() => {
      if (!cancelled) {
        setStartError("Erreur au démarrage du scan.");
        setIsStarting(false);
      }
    });

    return () => {
      cancelled = true;
      processingRef.current = false;
      void stopScanner();
    };
  }, [open, onClose, onEan13, regionId, stopScanner]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4"
      data-skip-ean-capture
      role="dialog"
      aria-modal="true"
      aria-label="Scanner un code-barres"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Fermer"
        onClick={() => {
          void stopScanner();
          onClose();
        }}
      />
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

        <div className="p-3">
          {permission === "denied" && (
            <div className="mb-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                Accès à la caméra refusé. Autorisez la caméra dans les réglages du navigateur, ou
                saisissez l&apos;EAN à la main dans le champ de recherche.
              </p>
            </div>
          )}
          {permission === "unavailable" && !startError && (
            <div className="mb-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <CameraOff className="mt-0.5 h-5 w-5 shrink-0" />
              <p>Aucune caméra disponible. Utilisez la saisie manuelle (douchette ou clavier).</p>
            </div>
          )}
          {startError && (
            <div className="mb-3 flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-3 text-sm text-red-800 ring-1 ring-red-100">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{startError}</p>
            </div>
          )}

          <div
            className="relative min-h-[240px] overflow-hidden rounded-2xl bg-black"
          >
            <div id={regionId} className="min-h-[240px] w-full" />
            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm text-white">
                Démarrage de la caméra…
              </div>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-gray-500">
            Cadre central : placez le code-barres (EAN-13) — lecture automatique
          </p>
        </div>
      </div>
    </div>
  );
}
