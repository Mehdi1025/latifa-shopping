import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { fetchCaEspecesMoisDepuisDb } from "@/lib/kpi/ca-especes-mois-from-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("non autorisé", {
      status: 401,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = String(
    (profile as { role?: string } | null)?.role ?? ""
  )
    .toLowerCase()
    .trim();

  if (role !== "admin") {
    return new NextResponse("non autorisé", {
      status: 403,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const montant =
    Math.round((await fetchCaEspecesMoisDepuisDb(supabase)) * 100) / 100;

  return new NextResponse(montant.toFixed(2), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
