"use client";

import { Lock } from "lucide-react";
import { useCaisseSession } from "./CaisseSessionProvider";

type Props = { className?: string; iconOnly?: boolean };

export default function CaisseClotureButton({ className, iconOnly }: Props) {
  const { isCaisseOuverte, openClotureModal } = useCaisseSession();
  if (!isCaisseOuverte) return null;
  return (
    <button
      type="button"
      onClick={openClotureModal}
      className={
        className ??
        (iconOnly
          ? "inline-flex h-9 w-9 items-center justify-center rounded-xl text-amber-900 transition hover:bg-amber-100"
          : "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-sm font-semibold text-amber-950 transition hover:bg-amber-100/90")
      }
      title="Fermer la caisse"
      aria-label="Fermer la caisse"
    >
      {iconOnly ? (
        <Lock className="h-4 w-4" strokeWidth={2} />
      ) : (
        <>🔒 Fermer la caisse</>
      )}
    </button>
  );
}
