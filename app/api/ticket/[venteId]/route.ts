import { NextResponse } from "next/server";

import { fetchReceiptByVenteId } from "@/lib/server/fetch-receipt";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ venteId: string }> }
) {
  try {
    const { venteId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const receipt = await fetchReceiptByVenteId(supabase, venteId);
    if (!receipt) {
      return NextResponse.json({ error: "Ticket introuvable." }, { status: 404 });
    }

    return NextResponse.json({ receipt });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Impossible de charger le ticket.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
