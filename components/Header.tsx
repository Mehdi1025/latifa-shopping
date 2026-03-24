"use client";

import {
  Search,
  Menu,
  Bell,
  LayoutGrid,
  TrendingUp,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotifications } from "@/contexts/NotificationsContext";

export default function Header({
  onMenuClick,
  isMobile,
  searchOpen,
  onSearchToggle,
}: {
  onMenuClick: () => void;
  isMobile: boolean;
  searchOpen: boolean;
  onSearchToggle: () => void;
}) {
  const { hasNewSale, clearNewSale } = useNotifications();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
      {/* Gauche : Menu hamburger (mobile) ou espace vide (desktop) */}
      <div className="flex w-9 shrink-0 items-center lg:w-auto">
        {isMobile ? (
          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-all duration-300 ease-in-out hover:bg-slate-100 hover:text-slate-700"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        ) : (
          <div className="h-9 w-9" />
        )}
      </div>

      {/* Centre : Barre de recherche */}
      <div className="relative flex flex-1 items-center justify-center lg:mx-4">
        {isMobile && !searchOpen ? (
          <button
            type="button"
            onClick={onSearchToggle}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-all duration-300 ease-in-out hover:bg-slate-100 hover:text-slate-700"
            aria-label="Rechercher"
          >
            <Search className="h-4 w-4" />
          </button>
        ) : (
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Rechercher dans Latifa Shop..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-300 ease-in-out focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus={isMobile && searchOpen}
            />
          </div>
        )}
      </div>

      {/* Droite : Icônes et avatar */}
      <div className="flex shrink-0 items-center gap-1">
        {!isMobile && (
          <>
            <button
              type="button"
              onClick={clearNewSale}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-all duration-300 ease-in-out hover:bg-slate-100 hover:text-slate-700"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <AnimatePresence>
                {hasNewSale && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute right-1 top-1 flex h-2.5 w-2.5 items-center justify-center"
                  >
                    <span className="h-full w-full rounded-full bg-red-500 ring-2 ring-white" />
                    <motion.span
                      className="absolute h-full w-full rounded-full bg-red-500"
                      animate={{ scale: [1, 2.5, 2.5], opacity: [0.6, 0, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-all duration-300 ease-in-out hover:bg-slate-100 hover:text-slate-700"
              aria-label="Applications"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-all duration-300 ease-in-out hover:bg-slate-100 hover:text-slate-700"
              aria-label="Activité"
            >
              <TrendingUp className="h-4 w-4" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={clearNewSale}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-all duration-300 ease-in-out hover:bg-slate-100 hover:text-slate-700 lg:hidden"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <AnimatePresence>
            {hasNewSale && (
              <motion.span
                initial={{ scale: 0.8 }}
                animate={{ scale: [1, 1.3, 1] }}
                exit={{ scale: 0 }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500"
              />
            )}
          </AnimatePresence>
        </button>
        <div className="ml-1 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-indigo-600 text-white">
          <User className="h-5 w-5" />
        </div>
      </div>
    </header>
  );
}
