import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { createConnectUrl, getBridgeToken } from "@/lib/bridgeApi";

export const dynamic = "force-dynamic";

function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
}

async function assertAdminBridgeConnect(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isAdminRole((profile as { role?: string } | null)?.role)) {
    throw new Error("FORBIDDEN");
  }
}

export async function GET() {
  try {
    await assertAdminBridgeConnect();
    const token = await getBridgeToken();
    const connectUrl = await createConnectUrl(token);
    return NextResponse.json({ url: connectUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur Bridge";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs." },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
