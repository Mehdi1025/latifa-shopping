"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const data = [
  { jour: "Lundi", ca: 980 },
  { jour: "Mardi", ca: 1120 },
  { jour: "Mercredi", ca: 1050 },
  { jour: "Jeudi", ca: 1340 },
  { jour: "Vendredi", ca: 1280 },
  { jour: "Samedi", ca: 1580 },
  { jour: "Dimanche", ca: 1450 },
];

export default function SalesChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="jour"
          tick={{ fill: "#64748b", fontSize: 12 }}
          axisLine={{ stroke: "#e2e8f0" }}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 12 }}
          axisLine={{ stroke: "#e2e8f0" }}
          tickFormatter={(value) => `${value} €`}
        />
        <Tooltip
          formatter={(value: unknown) => [value != null ? `${value} €` : "", "Chiffre d'affaires"]}
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
          }}
        />
        <Line
          type="monotone"
          dataKey="ca"
          stroke="#4f46e5"
          strokeWidth={3}
          dot={{ fill: "#4f46e5", strokeWidth: 0, r: 4 }}
          activeDot={{ r: 6, stroke: "#4f46e5", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
