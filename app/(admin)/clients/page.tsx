import type { Metadata } from "next";
import CrmSegmentation from "@/components/admin/CrmSegmentation";

export const metadata: Metadata = {
  title: "Clients — CRM RFM | Latifa Shop",
  description: "Segmentation VIP, Réguliers et relance",
};

export default function ClientsPage() {
  return (
    <div className="admin-container min-h-dvh bg-gray-50/50 p-4 md:p-6 lg:p-10">
      <header className="mb-8 lg:mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
          Clients
        </h1>
        <p className="mt-1 text-sm text-gray-400 md:text-base">
          CRM VIP &amp; rétention — analyse RFM (récence, fréquence, montant)
        </p>
      </header>

      <CrmSegmentation />
    </div>
  );
}
