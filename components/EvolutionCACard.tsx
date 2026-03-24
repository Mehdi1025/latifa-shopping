"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const dataSemaine = [
  { jour: "23 mars", nouveau: 420, enRetard: 80 },
  { jour: "24 mars", nouveau: 380, enRetard: 120 },
  { jour: "25 mars", nouveau: 450, enRetard: 90 },
  { jour: "26 mars", nouveau: 320, enRetard: 150 },
  { jour: "27 mars", nouveau: 510, enRetard: 70 },
  { jour: "28 mars", nouveau: 480, enRetard: 100 },
  { jour: "29 mars", nouveau: 390, enRetard: 110 },
];

const dataSemainePrecedente = [
  { jour: "16 mars", nouveau: 350, enRetard: 100 },
  { jour: "17 mars", nouveau: 410, enRetard: 90 },
  { jour: "18 mars", nouveau: 380, enRetard: 130 },
  { jour: "19 mars", nouveau: 440, enRetard: 80 },
  { jour: "20 mars", nouveau: 390, enRetard: 120 },
  { jour: "21 mars", nouveau: 460, enRetard: 70 },
  { jour: "22 mars", nouveau: 400, enRetard: 95 },
];


export default function EvolutionCACard() {
  const [activeTab, setActiveTab] = useState<"cette" | "derniere">("cette");
  const data = activeTab === "cette" ? dataSemaine : dataSemainePrecedente;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 transition-all duration-300 ease-in-out hover:scale-[1.01] hover:shadow-lg">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold tracking-tight text-slate-900">
          Évolution du CA
        </h3>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("cette")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-300 ease-in-out ${
              activeTab === "cette"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            Cette semaine
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("derniere")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-300 ease-in-out ${
              activeTab === "derniere"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            Dernière semaine
          </button>
        </div>
      </div>
      <div className="mb-5 flex items-baseline gap-3">
        <span className="text-3xl font-bold tracking-tight text-slate-800 tabular-nums">
          {activeTab === "cette" ? "2 970" : "2 830"}
          <span className="ml-1 text-lg font-normal text-slate-500">€</span>
        </span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-medium text-emerald-700">
          ↑ {activeTab === "cette" ? "4.9" : "3.2"}%
        </span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
          >
            <XAxis
              dataKey="jour"
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}€`}
            />
            <Tooltip
              contentStyle={{
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "12px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
              formatter={(value: unknown) => [value != null ? `${value} €` : "", ""]}
            />
            <Bar
              dataKey="nouveau"
              fill="url(#barGradientIndigo)"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <Bar
              dataKey="enRetard"
              fill="#e2e8f0"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <defs>
              <linearGradient id="barGradientIndigo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-5 flex items-center gap-6 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
          Nouveau
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          En retard
        </span>
      </div>
    </section>
  );
}
