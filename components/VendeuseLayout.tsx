"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, History, Target, Menu, X, User, CheckSquare, BookOpen, Package } from "lucide-react";
import LogoutButton from "./LogoutButton";
import { Toaster } from "sonner";

const navItems = [
  { href: "/vendeuse", label: "Nouvelle Vente", icon: ShoppingCart },
  { href: "/vendeuse/reception", label: "Réception", icon: Package },
  { href: "/vendeuse/taches", label: "Mes Missions", icon: CheckSquare },
  { href: "/vendeuse/process", label: "Guide Interne", icon: BookOpen },
  { href: "/vendeuse/historique", label: "Historique", icon: History },
  { href: "/vendeuse/objectifs", label: "Mes Objectifs", icon: Target },
];

function navLinkActive(pathname: string, href: string) {
  if (href === "/vendeuse") return pathname === "/vendeuse";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function VendeuseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          classNames: {
            toast: "rounded-2xl shadow-lg",
          },
        }}
      />
      {/* Sidebar Tablette: Collapsed (icônes uniquement) - md à lg */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-20 flex-col border-r border-gray-100 bg-white/80 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.06)] backdrop-blur-xl md:flex lg:hidden">
        <div className="flex h-14 items-center justify-center border-b border-gray-100">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-sm font-bold text-white">
            L
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = navLinkActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl p-3 text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0 stroke-[1.5]" />
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-100 p-3">
          <div className="flex justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200">
              <User className="h-4 w-4 text-gray-600" />
            </div>
          </div>
          <div className="mt-2 flex justify-center">
            <LogoutButton variant="sidebar" compact />
          </div>
        </div>
      </aside>

      {/* Sidebar Desktop - lg+ */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-20 flex-col border-r border-gray-100 bg-white shadow-[0_4px_20px_-5px_rgba(0,0,0,0.04)] lg:flex xl:w-56">
        <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4 xl:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-sm font-bold text-white">
              L
            </div>
            <span className="hidden text-sm font-semibold text-gray-900 xl:inline">
              Latifa POS
            </span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-6 xl:px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = navLinkActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 ease-out xl:px-4 ${
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0 stroke-[1.5]" />
                <span className="hidden xl:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-100 p-3 xl:p-5">
          <div className="mb-3 hidden items-center gap-3 rounded-xl bg-gray-50/80 px-3 py-2.5 xl:flex xl:px-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200">
              <User className="h-4 w-4 text-gray-600" />
            </div>
            <span className="truncate text-sm font-medium text-gray-700">
              Vendeuse
            </span>
          </div>
          <div className="mb-2 flex justify-center xl:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200">
              <User className="h-4 w-4 text-gray-600" />
            </div>
          </div>
          <div className="flex justify-center xl:hidden">
            <LogoutButton variant="sidebar" compact />
          </div>
          <div className="hidden xl:block">
            <LogoutButton variant="sidebar" />
          </div>
        </div>
      </aside>

      {/* Mobile: Top Bar (hidden on tablet - sidebar handles nav) */}
      <div className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-gray-100 bg-white px-5 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.04)] md:hidden">
        <span className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-900 text-xs font-bold text-white">
            L
          </div>
          <span className="text-sm font-semibold text-gray-900">Latifa POS</span>
        </span>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition-all duration-300 hover:bg-gray-100 active:scale-95"
          aria-label="Menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile: Drawer Profil/Logout */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed right-0 top-14 z-40 w-64 rounded-bl-2xl border-b border-l border-gray-100 bg-white py-4 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] md:hidden">
            <div className="flex items-center gap-3 px-5 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                <User className="h-5 w-5 text-gray-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Vendeuse</span>
            </div>
            <div className="px-4">
              <LogoutButton variant="sidebar" />
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="flex min-h-0 flex-1 flex-col pt-14 pb-24 md:ml-20 md:pt-0 md:pb-0 lg:ml-20 xl:ml-56">
        {children}
      </main>

      {/* Bottom Nav Mobile uniquement (< md) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-start gap-1 overflow-x-auto border-t border-gray-100 bg-white/95 px-2 py-2 backdrop-blur-md md:hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = navLinkActive(pathname, item.href);
          const shortLabels: Record<string, string> = {
            "Nouvelle Vente": "Vente",
            Réception: "Récep.",
            "Mes Missions": "Missions",
            "Guide Interne": "Guide",
            Historique: "Historique",
            "Mes Objectifs": "Objectifs",
          };
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[4.25rem] shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-2 transition-all duration-300 active:scale-95 ${
                isActive ? "text-gray-900" : "text-gray-400"
              }`}
            >
              <Icon className="h-5 w-5 stroke-[1.5]" />
              <span className="max-w-[4.25rem] truncate text-center text-[9px] font-medium leading-tight">
                {shortLabels[item.label] ?? item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
