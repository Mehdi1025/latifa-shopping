import { redirect } from "next/navigation";

/** Ancienne URL : conservée pour les favoris / liens. */
export default function LegacyStockPathRedirect() {
  redirect("/stock");
}
