"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import LogoutButton from "./LogoutButton";
import {
  LayoutDashboard,
  BarChart3,
  Contact,
  Gauge,
  Package,
  Settings,
  Target,
  Kanban,
  FileUp,
} from "lucide-react";

const bottomNavItems = [
  { href: "/", label: "Accueil", icon: LayoutDashboard },
  { href: "/kpi", label: "KPI", icon: BarChart3 },
  { href: "/produits", label: "Stock", icon: Package },
  { href: "/organisation", label: "Organisation", icon: Kanban },
];

const tabletNavItems = [
  { href: "/", label: "Accueil", icon: LayoutDashboard },
  { href: "/kpi", label: "KPI", icon: BarChart3 },
  { href: "/objectifs", label: "Objectifs", icon: Target },
  { href: "/clients", label: "Clients", icon: Contact },
  { href: "/stock", label: "Runway", icon: Gauge },
  { href: "/produits", label: "Produits", icon: Package },
  { href: "/import", label: "Import", icon: FileUp },
  { href: "/organisation", label: "Organisation", icon: Kanban },
  { href: "/parametres", label: "Réglages", icon: Settings },
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
    <div className="flex min-h-dvh flex-col">
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
      {/* Tablette md–lg : barre icônes, s’élargit au survol (labels) */}
      <aside className="group/sidebar fixed left-0 top-0 z-40 hidden h-screen w-20 overflow-x-hidden border-r border-slate-100 bg-white/90 shadow-[4px_0_24px_-8px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-[width] duration-300 ease-out hover:w-64 hover:shadow-[8px_0_32px_-12px_rgba(0,0,0,0.12)] md:flex lg:hidden">
        <div className="flex h-full w-64 min-w-[16rem] flex-col">
          <div className="flex h-14 shrink-0 items-center border-b border-slate-100 px-3 py-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
              L
            </div>
            <span className="ml-3 max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold text-slate-900 opacity-0 transition-all duration-300 group-hover/sidebar:max-w-[160px] group-hover/sidebar:opacity-100">
              Latifa
            </span>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-4">
            {tabletNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex h-12 shrink-0 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors md:text-base ${
                    isActive
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0 stroke-[1.5]" />
                  <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover/sidebar:max-w-[200px] group-hover/sidebar:opacity-100">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="shrink-0 border-t border-slate-100 p-2 group-hover/sidebar:px-3 group-hover/sidebar:py-3">
            <div className="hidden group-hover/sidebar:block">
              <LogoutButton variant="sidebar" />
            </div>
            <div className="flex justify-center group-hover/sidebar:hidden">
              <LogoutButton variant="sidebar" compact />
            </div>
          </div>
        </div>
      </aside>

      <div className="admin-container flex min-h-0 flex-1 flex-col md:ml-20 lg:ml-64">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          isMobile={isMobile}
          searchOpen={searchOpen}
          onSearchToggle={() => setSearchOpen(!searchOpen)}
        />
        <main className="flex min-h-0 flex-1 flex-col pb-24 md:pb-0">{children}</main>
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
              className="flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 transition-all active:scale-95"
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
    </div>
  );
}
