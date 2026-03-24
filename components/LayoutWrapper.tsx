"use client";

import { usePathname } from "next/navigation";
import DashboardLayout from "./DashboardLayout";

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
