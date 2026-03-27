"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  CheckSquare,
  Workflow,
  Package,
  Gauge,
  Settings,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import LogoutButton from "./LogoutButton";

const navSections = [
  {
    label: "PAGES",
    items: [
      { href: "/", label: "Accueil", icon: LayoutDashboard },
      { href: "/kpi", label: "KPI", icon: BarChart3 },
    ],
  },
  {
    label: "GESTION",
    items: [
      { href: "/taches", label: "Tâches", icon: CheckSquare, badge: true },
      { href: "/process", label: "Process", icon: Workflow },
      { href: "/stock", label: "Runway", icon: Gauge },
      { href: "/produits", label: "Produits", icon: Package },
    ],
  },
  {
    label: "ADMIN",
    items: [{ href: "/parametres", label: "Paramètres", icon: Settings }],
  },
];

export default function Sidebar({
  isOpen,
  onClose,
  isMobile,
}: {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
}) {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "PAGES",
    "GESTION",
    "ADMIN",
  ]);

  const toggleSection = (label: string) => {
    setExpandedSections((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]
    );
  };

  const handleLinkClick = () => {
    if (isMobile) onClose();
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-100 px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
            L
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            Latifa
          </span>
        </div>
        {isMobile && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-all duration-300 ease-in-out hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navSections.map((section) => {
          const isExpanded = expandedSections.includes(section.label);
          return (
            <div key={section.label} className="mb-6">
              <button
                type="button"
                onClick={() => toggleSection(section.label)}
                className="mb-2 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400 transition-all duration-300 ease-in-out hover:text-slate-600"
              >
                {section.label}
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
              {isExpanded && (
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/" && pathname.startsWith(item.href));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleLinkClick}
                        className={`group flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-300 ease-in-out ${
                          isActive
                            ? "bg-indigo-50 text-indigo-600"
                            : "text-slate-600 hover:translate-x-0.5 hover:bg-slate-50 hover:opacity-100 hover:text-slate-900"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={`h-4 w-4 shrink-0 stroke-[1.5] transition-colors duration-300 ${
                              isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                            }`}
                          />
                          {item.label}
                        </div>
                        {item.badge && (
                          <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                            New
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 px-3 py-4">
        <LogoutButton variant="sidebar" />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-72 max-w-[85vw] border-r border-slate-100 bg-white shadow-xl transition-transform duration-300 ease-in-out lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    );
  }

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-slate-100 bg-white lg:block">
      {sidebarContent}
    </aside>
  );
}
