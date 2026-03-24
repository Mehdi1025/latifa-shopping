"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type LogoutButtonProps = {
  variant?: "sidebar" | "page";
  className?: string;
};

export default function LogoutButton({ variant = "page", className = "" }: LogoutButtonProps) {
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
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-red-600 transition-all duration-300 ease-in-out hover:bg-red-50 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <LogOut className="h-4 w-4 shrink-0 stroke-[1.5]" />
        {loading ? "Déconnexion..." : "Se déconnecter"}
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
