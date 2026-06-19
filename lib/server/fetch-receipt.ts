import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildClientReceipt,
  formatVariantSubtitle,
} from "@/lib/ticket/format";
import type { ClientReceipt, ReceiptLine } from "@/lib/ticket/receipt-types";

type VenteRow = {
  id: string;
  total: number | null;
  remise?: number | null;
  methode_paiement?: string | null;
  created_at: string;
  client_id?: string | null;
  vendeur_id?: string | null;
};

type ItemRow = {
  produit_id: string;
  quantite: number | null;
  prix_unitaire: number | null;
  libelle_ligne?: string | null;
};

type ProduitRow = {
  id: string;
  nom: string;
  taille?: string | null;
  couleur?: string | null;
};

/** Charge un ticket client complet depuis Supabase. */
export async function fetchReceiptByVenteId(
  supabase: SupabaseClient,
  venteId: string
): Promise<ClientReceipt | null> {
  const { data: vente, error: venteErr } = await supabase
    .from("ventes")
    .select(
      "id, total, remise, methode_paiement, created_at, client_id, vendeur_id"
    )
    .eq("id", venteId)
    .maybeSingle();

  if (venteErr || !vente) return null;

  const v = vente as VenteRow;

  const [{ data: items }, clientRes, vendeurRes] = await Promise.all([
    supabase
      .from("ventes_items")
      .select("produit_id, quantite, prix_unitaire, libelle_ligne")
      .eq("vente_id", venteId),
    v.client_id
      ? supabase
          .from("clients")
          .select("nom, telephone, email")
          .eq("id", v.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    v.vendeur_id
      ? supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", v.vendeur_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const itemRows = (items ?? []) as ItemRow[];
  const produitIds = [...new Set(itemRows.map((i) => i.produit_id))];

  let produitsById = new Map<string, ProduitRow>();
  if (produitIds.length > 0) {
    const { data: produits } = await supabase
      .from("produits")
      .select("id, nom, taille, couleur")
      .in("id", produitIds);
    produitsById = new Map(
      ((produits ?? []) as ProduitRow[]).map((p) => [p.id, p])
    );
  }

  const lines: ReceiptLine[] = itemRows.map((item) => {
    const produit = produitsById.get(item.produit_id);
    const qty = item.quantite ?? 0;
    const unit = item.prix_unitaire ?? 0;
    const label =
      item.libelle_ligne?.trim() ||
      produit?.nom ||
      "Article";
    const subtitle = produit ? formatVariantSubtitle(produit) ?? undefined : undefined;

    return {
      label,
      subtitle,
      quantity: qty,
      unitPrice: unit,
      lineTotal: Math.round(unit * qty * 100) / 100,
    };
  });

  const client = clientRes.data as {
    nom?: string;
    telephone?: string | null;
    email?: string | null;
  } | null;

  const vendeur = vendeurRes.data as {
    full_name?: string | null;
    email?: string | null;
  } | null;

  const vendeuseName =
    (typeof vendeur?.full_name === "string" && vendeur.full_name.trim()) ||
    vendeur?.email ||
    undefined;

  return buildClientReceipt({
    venteId: v.id,
    createdAt: v.created_at,
    total: v.total ?? 0,
    remise: v.remise,
    methodePaiement: v.methode_paiement,
    vendeuseName,
    clientName: client?.nom,
    clientEmail: client?.email ?? undefined,
    clientPhone: client?.telephone ?? undefined,
    lines,
  });
}
