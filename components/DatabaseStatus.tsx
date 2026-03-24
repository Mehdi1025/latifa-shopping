"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

export default function DatabaseStatus() {
  const [status, setStatus] = useState<"loading" | "connected" | "error">("loading");

  useEffect(() => {
    async function checkConnection() {
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.getSession();
        setStatus("connected");
      } catch {
        setStatus("error");
      }
    }

    checkConnection();
  }, []);

  if (status === "loading") return null;

  return (
    <p
      className={`mt-12 text-center text-xs ${
        status === "connected" ? "text-emerald-600" : "text-red-600"
      }`}
    >
      Statut Base de données :{" "}
      {status === "connected" ? "Connecté" : "Erreur de connexion"}
    </p>
  );
}
