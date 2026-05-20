import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";

import { plaidClient } from "@/lib/plaidApi";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: "latifa_admin_1" },
      client_name: "Tableau de bord Latifa",
      products: [Products.Transactions],
      country_codes: [CountryCode.Fr],
      language: "fr",
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error: unknown) {
    const plaidError =
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: { data?: unknown } }).response?.data !== "undefined"
        ? (error as { response?: { data?: unknown } }).response?.data
        : error;

    console.error("Plaid linkTokenCreate error:", plaidError);

    return NextResponse.json(
      { error: "Impossible de créer le token Plaid Link." },
      { status: 500 }
    );
  }
}
