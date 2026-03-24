"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

type NotificationsContextType = {
  hasNewSale: boolean;
  triggerNewSale: (amount: number) => void;
  clearNewSale: () => void;
};

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [hasNewSale, setHasNewSale] = useState(false);

  const triggerNewSale = useCallback((_amount: number) => {
    setHasNewSale(true);
  }, []);

  const clearNewSale = useCallback(() => {
    setHasNewSale(false);
  }, []);

  return (
    <NotificationsContext.Provider value={{ hasNewSale, triggerNewSale, clearNewSale }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) return { hasNewSale: false, triggerNewSale: () => {}, clearNewSale: () => {} };
  return ctx;
}
