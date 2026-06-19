import { NextResponse } from "next/server";

import { assertAdminSession } from "@/lib/server/assert-admin";
import {
  isLastAdminChangeBlocked,
  isLastAdminRemovalBlocked,
  listAdminIds,
} from "@/lib/server/team-rules";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PatchBody = {
  role?: string;
  full_name?: string | null;
};

function normalizeRole(role: string | undefined): "admin" | "vendeuse" | null {
  if (role === undefined) return null;
  return role.trim().toLowerCase() === "admin" ? "admin" : "vendeuse";
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await assertAdminSession();
  if (session instanceof NextResponse) return session;

  const { id: targetUserId } = await context.params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const nextRole = normalizeRole(body.role);
  const patch: Record<string, string | null> = {};

  if (nextRole !== null) patch.role = nextRole;
  if (body.full_name !== undefined) {
    patch.full_name =
      typeof body.full_name === "string" && body.full_name.trim()
        ? body.full_name.trim()
        : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie." }, { status: 400 });
  }

  try {
    if (nextRole !== null) {
      const adminIds = await listAdminIds(session.supabase);
      if (isLastAdminChangeBlocked(adminIds, targetUserId, nextRole)) {
        return NextResponse.json(
          { error: "Impossible de retirer le dernier administrateur." },
          { status: 400 }
        );
      }
    }

    const { data, error } = await session.supabase
      .from("profiles")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", targetUserId)
      .select("id, email, full_name, role, updated_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, profile: data });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Impossible de mettre à jour le profil.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await assertAdminSession();
  if (session instanceof NextResponse) return session;

  const { id: targetUserId } = await context.params;

  if (targetUserId === session.userId) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas supprimer votre propre compte." },
      { status: 400 }
    );
  }

  try {
    const adminIds = await listAdminIds(session.supabase);
    if (isLastAdminRemovalBlocked(adminIds, targetUserId)) {
      return NextResponse.json(
        { error: "Impossible de supprimer le dernier administrateur." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(targetUserId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: "Utilisateur supprimé." });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Impossible de supprimer l'utilisateur.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
