"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Sparkles } from "lucide-react";

const LOTS_EXEMPLES = [
  "Voile Premium Signature",
  "Ensemble Soirée Élégance",
  "Abaya Capsule Exclusive",
  "Coffret Accessoires Dorés",
  "Tenue capsule Printemps",
];

type MysteryVaultProps = {
  /** Appelé avec le nom du lot gagné — la caisse ajoute la ligne 15 € */
  onUnlock: (lotNom: string) => void;
  className?: string;
};

export default function MysteryVault({ onUnlock, className = "" }: MysteryVaultProps) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [lotNom, setLotNom] = useState<string | null>(null);

  const handleOpen = () => {
    setOpen(true);
    setRevealed(false);
    setLotNom(null);
  };

  const handleReveal = () => {
    const pick =
      LOTS_EXEMPLES[Math.floor(Math.random() * LOTS_EXEMPLES.length)]!;
    setLotNom(pick);
    setRevealed(true);
    onUnlock(pick);
  };

  const handleClose = () => {
    setOpen(false);
    setRevealed(false);
    setLotNom(null);
  };

  return (
    <>
      <div className={className}>
        <button
          type="button"
          onClick={handleOpen}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 to-white px-4 py-3.5 text-sm font-semibold text-violet-900 shadow-sm ring-1 ring-violet-100/60 transition hover:shadow-md active:scale-[0.99]"
        >
          <Gift className="h-5 w-5 text-violet-600" />
          Coffre Noir — découvrir un lot
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Coffre Noir"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[215] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
            onClick={handleClose}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="relative w-full max-w-md rounded-3xl border border-white/15 bg-zinc-900/95 p-6 shadow-2xl ring-1 ring-amber-500/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center gap-2 text-amber-200/90">
                <Sparkles className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                  Coffre Noir
                </span>
              </div>
              <h3 className="font-serif text-xl text-white">
                Une surprise vous attend
              </h3>
              <p className="mt-2 text-sm text-white/55">
                Révélez le lot gagné. Il sera ajouté au panier à{" "}
                <span className="font-semibold text-amber-200">15&nbsp;€</span>.{" "}
              </p>

              {!revealed ? (
                <button
                  type="button"
                  onClick={handleReveal}
                  className="mt-6 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 py-4 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
                >
                  Débloquer mon lot
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-4 text-center"
                >
                  <p className="text-xs uppercase tracking-wider text-amber-200/70">
                    Lot gagné
                  </p>
                  <p className="mt-2 font-serif text-lg text-white">
                    {lotNom}
                  </p>
                  <p className="mt-2 text-xs text-white/45">
                    Ajouté au panier — encaissez pour finaliser.
                  </p>
                </motion.div>
              )}

              <button
                type="button"
                onClick={handleClose}
                className="mt-4 w-full rounded-xl py-2 text-sm text-white/50 transition hover:text-white"
              >
                Fermer
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
