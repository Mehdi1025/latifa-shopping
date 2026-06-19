import { NextResponse } from "next/server";

import { fetchReceiptByVenteId } from "@/lib/server/fetch-receipt";
import {
  sendTicketEmail,
  TicketEmailError,
} from "@/lib/server/send-ticket-email";
import { isValidEmail } from "@/lib/ticket/format";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  email?: string;
  /** Met à jour l'e-mail du client lié à la vente si client_id présent */
  saveToClient?: boolean;
};

export async function POST(
  request: Request,
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

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
    }

    const email = body.email?.trim() ?? "";
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
    }

    const receipt = await fetchReceiptByVenteId(supabase, venteId);
    if (!receipt) {
      return NextResponse.json({ error: "Ticket introuvable." }, { status: 404 });
    }

    await sendTicketEmail({ ...receipt, clientEmail: email }, email);

    await supabase
      .from("ventes")
      .update({ ticket_email_envoye_at: new Date().toISOString() })
      .eq("id", venteId);

    if (body.saveToClient) {
      const { data: vente } = await supabase
        .from("ventes")
        .select("client_id")
        .eq("id", venteId)
        .maybeSingle();

      const clientId = (vente as { client_id?: string | null } | null)?.client_id;
      if (clientId) {
        await supabase.from("clients").update({ email }).eq("id", clientId);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Ticket envoyé à ${email}.`,
    });
  } catch (err) {
    if (err instanceof TicketEmailError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Impossible d'envoyer le ticket.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
