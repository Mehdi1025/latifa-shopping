"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type LogoutButtonProps = {
  variant?: "sidebar" | "page";
  className?: string;
  /** Icône seule — barre latérale repliée (tablette) */
  compact?: boolean;
};

export default function LogoutButton({
  variant = "page",
  className = "",
  compact = false,
}: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  if (variant === "sidebar") {
    if (compact) {
      return (
        <button
          type="button"
          onClick={handleLogout}
          disabled={loading}
          title="Se déconnecter"
          aria-label="Se déconnecter"
          className={`flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl text-red-600 transition-all duration-300 ease-in-out hover:bg-red-50 hover:text-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        >
          <LogOut className="h-5 w-5 shrink-0 stroke-[1.5]" />
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        title={loading ? "Déconnexion..." : "Se déconnecter"}
        className={`flex h-12 min-h-12 w-full min-w-0 items-center gap-2 rounded-xl px-2.5 text-xs font-medium text-red-600 transition-all duration-300 ease-in-out hover:bg-red-50 hover:text-red-700 sm:gap-2.5 sm:px-3 sm:text-sm md:text-base disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <LogOut className="h-4 w-4 shrink-0 stroke-[1.5]" />
        <span className="min-w-0 truncate text-left">
          {loading ? "Déconnexion..." : "Se déconnecter"}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition-all duration-300 ease-in-out hover:bg-red-50 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      {loading ? "Déconnexion..." : "Se déconnecter"}
    </button>
  );
}
