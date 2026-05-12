"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DELAY_MS = 2000;

/**
 * Retour automatique vers la trésorerie après succès Bridge.
 */
export default function BridgeCallbackRedirect() {
  const router = useRouter();

  useEffect(() => {
    const t = window.setTimeout(() => {
      router.replace("/dashboard/finance");
    }, DELAY_MS);
    return () => window.clearTimeout(t);
  }, [router]);

  return null;
}
