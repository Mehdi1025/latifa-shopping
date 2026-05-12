import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import BridgeCallbackRedirect from "@/components/finance/BridgeCallbackRedirect";

export const dynamic = "force-dynamic";

type SearchInput = Record<string, string | string[] | undefined>;

function firstParam(sp: SearchInput, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
  return undefined;
}

function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
}

export default async function BridgeFinanceCallbackPage({
  searchParams,
}: {
  searchParams: Promise<SearchInput>;
}) {
  const sp = await searchParams;

  const success = firstParam(sp, "success");
  const itemId = firstParam(sp, "item_id");

  if (success === "false") {
    redirect("/dashboard/finance?error=cancelled");
  }

  if (!itemId) {
    redirect("/dashboard/finance?error=cancelled");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/finance/callback");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isAdminRole((profile as { role?: string } | null)?.role)) {
    redirect("/dashboard/finance?error=forbidden");
  }

  const { error } = await supabase.from("shop_settings").upsert(
    {
      id: 1,
      bridge_item_id: itemId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    redirect("/dashboard/finance?error=save_failed");
  }

  return (
    <div className="admin-container flex min-h-dvh flex-col items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_8px_40px_-24px_rgba(15,23,42,0.12)]">
        <p className="text-lg font-semibold leading-relaxed text-slate-900 md:text-xl">
          ✅ Connexion bancaire réussie ! Nous synchronisons vos données…
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Redirection automatique vers la trésorerie sous quelques secondes.
        </p>
      </div>
      <BridgeCallbackRedirect />
    </div>
  );
}
