"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import LogoutButton from "./LogoutButton";
import { LayoutDashboard, BarChart3, Package, Users, Settings } from "lucide-react";

const bottomNavItems = [
  { href: "/", label: "Stats", icon: BarChart3 },
  { href: "/produits", label: "Stock", icon: Package },
  { href: "/taches", label: "Équipe", icon: Users },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (sidebarOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
  }, [sidebarOpen]);

  return (
    <>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isMobile={isMobile}
      />
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}
      {/* Sidebar Tablette: Collapsed (icônes uniquement) - md à lg */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-20 flex-col border-r border-slate-100 bg-white/80 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.06)] backdrop-blur-xl md:flex lg:hidden">
        <div className="flex h-14 items-center justify-center border-b border-slate-100">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
            L
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-6">
          <Link href="/" title="Accueil" className={`flex items-center justify-center rounded-2xl p-3 text-sm font-medium transition-all ${pathname === "/" ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>
            <LayoutDashboard className="h-5 w-5 shrink-0 stroke-[1.5]" />
          </Link>
          <Link href="/kpi" title="KPI" className={`flex items-center justify-center rounded-2xl p-3 text-sm font-medium transition-all ${pathname.startsWith("/kpi") ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>
            <BarChart3 className="h-5 w-5 shrink-0 stroke-[1.5]" />
          </Link>
          <Link href="/produits" title="Produits" className={`flex items-center justify-center rounded-2xl p-3 text-sm font-medium transition-all ${pathname.startsWith("/produits") ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>
            <Package className="h-5 w-5 shrink-0 stroke-[1.5]" />
          </Link>
          <Link href="/taches" title="Tâches" className={`flex items-center justify-center rounded-2xl p-3 text-sm font-medium transition-all ${pathname.startsWith("/taches") ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>
            <Users className="h-5 w-5 shrink-0 stroke-[1.5]" />
          </Link>
          <Link href="/parametres" title="Paramètres" className={`flex items-center justify-center rounded-2xl p-3 text-sm font-medium transition-all ${pathname.startsWith("/parametres") ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>
            <Settings className="h-5 w-5 shrink-0 stroke-[1.5]" />
          </Link>
        </nav>
        <div className="border-t border-slate-100 p-3">
          <LogoutButton variant="sidebar" />
        </div>
      </aside>

      <div className="flex min-h-screen flex-col md:ml-20 lg:ml-64">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          isMobile={isMobile}
          searchOpen={searchOpen}
          onSearchToggle={() => setSearchOpen(!searchOpen)}
        />
        <main className="flex-1 pb-24 md:pb-0">{children}</main>
      </div>

      {/* Bottom Nav Mobile uniquement (< md) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-gray-100 bg-white/95 py-3 backdrop-blur-md md:hidden">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 transition-all active:scale-95"
            >
              <Icon
                className={`h-5 w-5 stroke-[1.5] ${
                  isActive ? "text-gray-900" : "text-gray-400"
                }`}
              />
              <span
                className={`text-[10px] font-medium ${
                  isActive ? "text-gray-900" : "text-gray-400"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
