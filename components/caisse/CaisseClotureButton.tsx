"use client";

import { Lock } from "lucide-react";
import { useCaisseSession } from "./CaisseSessionProvider";

type Props = {
  className?: string;
  /** Icône seule (sidebar étroite) */
  iconOnly?: boolean;
};

const baseFooter =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 hover:text-gray-900 active:scale-[0.99]";

const baseIcon =
  "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50";

export default function CaisseClotureButton({
  className,
  iconOnly,
}: Props) {
  const { isCaisseOuverte, openClotureModal } = useCaisseSession();
  if (!isCaisseOuverte) return null;

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={openClotureModal}
        className={className ?? baseIcon}
        title="Fermer la caisse"
        aria-label="Fermer la caisse"
      >
        <Lock className="h-4 w-4" strokeWidth={2} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openClotureModal}
      className={className ?? baseFooter}
    >
      <Lock className="h-4 w-4 shrink-0 text-gray-500" strokeWidth={2} />
      Fermer la caisse
    </button>
  );
}
