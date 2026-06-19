import { NextResponse } from "next/server";

import { assertAdminSession } from "@/lib/server/assert-admin";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InviteBody = {
  email?: string;
  full_name?: string;
  role?: string;
};

function normalizeRole(role: string | undefined): "admin" | "vendeuse" {
  return role?.trim().toLowerCase() === "admin" ? "admin" : "vendeuse";
}

export async function POST(request: Request) {
  const session = await assertAdminSession();
  if (session instanceof NextResponse) return session;

  let body: InviteBody;
  try {
    body = (await request.json()) as InviteBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }

  const fullName = body.full_name?.trim() ?? "";
  const role = normalizeRole(body.role);

  try {
    const admin = createSupabaseAdminClient();
    const origin =
      request.headers.get("origin") ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      "http://localhost:3000";

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName || null,
        role,
      },
      redirectTo: `${origin.replace(/\/$/, "")}/login`,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (data.user?.id) {
      await admin.from("profiles").upsert(
        {
          id: data.user.id,
          email,
          full_name: fullName || null,
          role,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Invitation envoyée à ${email}.`,
      userId: data.user?.id ?? null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Impossible d'envoyer l'invitation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
