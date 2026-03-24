"use client";

import { ResponsiveContainer, Area, AreaChart } from "recharts";

const sparklineData = [
  { v: 120 },
  { v: 180 },
  { v: 150 },
  { v: 200 },
  { v: 160 },
  { v: 220 },
  { v: 190 },
];

interface KPICardProps {
  title: string;
  value: string;
  trend: string;
  trendPositive: boolean;
  fromLabel?: string;
  delay?: number;
}

const INDIGO_GRADIENT = "#4f46e5";
const INDIGO_LIGHT = "#818cf8";

export default function KPICard({
  title,
  value,
  trend,
  trendPositive,
  fromLabel = "vs hier",
  delay = 0,
}: KPICardProps) {
  const gradientId = `spark-indigo-${title.replace(/\s+/g, "-").replace(/[^a-z0-9-]/gi, "").toLowerCase()}`;

  return (
    <article
      className="group animate-fade-in-up opacity-0 rounded-xl border border-slate-200 bg-white p-5 transition-all duration-300 ease-in-out hover:scale-[1.01] hover:shadow-lg"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
        {title}
      </p>
      <div className="mt-3 flex items-start justify-between gap-4">
        <p className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums lg:text-3xl">
          {value}
        </p>
        <div className="h-14 w-28 shrink-0 opacity-90 transition-opacity duration-300 group-hover:opacity-100">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={INDIGO_GRADIENT} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={INDIGO_LIGHT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={INDIGO_GRADIENT}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs">
        <span
          className={`font-medium ${
            trendPositive ? "text-emerald-600" : "text-red-500"
          }`}
        >
          {trend}
        </span>
        <span className="text-slate-500">vs {fromLabel}</span>
      </div>
    </article>
  );
}
