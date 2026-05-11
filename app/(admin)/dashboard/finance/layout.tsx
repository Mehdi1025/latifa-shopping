/**
 * Route dynamique : évite le prérendu statique problématique avec actions serveur /
 * flux authentifiés sur la page trésorerie (digest d’erreur RSC en prod).
 */
export const dynamic = "force-dynamic";

export default function DashboardFinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
