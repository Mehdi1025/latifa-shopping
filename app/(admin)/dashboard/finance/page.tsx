import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import FinanceDashboardClient from "./finance-dashboard-client";

function FinancePageFallback() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 pb-16 text-slate-600">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" aria-hidden />
      <p className="text-sm font-medium">Chargement de la trésorerie…</p>
    </div>
  );
}

export default function TresorerieFinancePage() {
  return (
    <Suspense fallback={<FinancePageFallback />}>
      <FinanceDashboardClient />
    </Suspense>
  );
}
