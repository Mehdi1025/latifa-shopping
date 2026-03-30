"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

type TabsContextValue = {
  value: string;
  setValue: (v: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

export function Tabs({
  defaultValue,
  children,
  className = "",
}: {
  defaultValue: string;
  children: ReactNode;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`inline-flex h-11 items-center justify-center gap-1 rounded-2xl border border-white/30 bg-white/50 p-1 shadow-sm backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  if (!ctx) return null;
  const active = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx.setValue(value)}
      className={`inline-flex min-h-10 min-w-[8rem] items-center justify-center rounded-xl px-4 text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-neutral-900 text-white shadow-md"
          : "text-neutral-600 hover:bg-white/80 hover:text-neutral-900"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  if (!ctx || ctx.value !== value) return null;
  return (
    <div role="tabpanel" className={`mt-6 outline-none ${className}`}>
      {children}
    </div>
  );
}
