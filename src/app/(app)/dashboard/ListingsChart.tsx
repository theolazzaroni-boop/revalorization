"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

type WeekData = {
  week: string;
  Nouvelles: number;
  Planifiées: number;
  Collectées: number;
  Annulées: number;
};

export default function ListingsChart({ data }: { data: WeekData[] }) {
  if (data.every((d) => d.Nouvelles + d.Planifiées + d.Collectées + d.Annulées === 0)) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        Pas encore de données à afficher
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barSize={10} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
          cursor={{ fill: "#f9fafb" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
        <Bar dataKey="Nouvelles"  fill="#3b82f6" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Planifiées" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Collectées" fill="#10b981" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Annulées"   fill="#d1d5db" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
