"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type CollectionItem = {
  surplusListing: {
    quantityEstimated: number;
    partner: { id: string; name: string };
    material: { id: string; name: string; co2FactorPerUnit: number };
  };
};

export type CollectionRow = {
  id: string;
  scheduledDate: string;
  actualDate: string | null;
  status: string;
  operator: { id: string; name: string } | null;
  vehicle: { id: string; name: string; plate: string | null } | null;
  collectionItems: CollectionItem[];
};

type FilterOption = { id: string; name: string };

type Props = {
  collections: CollectionRow[];
  operators: FilterOption[];
  vehicles: (FilterOption & { plate: string | null })[];
  partners: FilterOption[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; cal: string }> = {
  SCHEDULED:   { label: "Planifiée",  color: "bg-amber-100 text-amber-700",     dot: "bg-amber-500",   cal: "bg-amber-50 text-amber-700 border-amber-200" },
  READY:       { label: "Prête",      color: "bg-purple-100 text-purple-700",   dot: "bg-purple-500",  cal: "bg-purple-50 text-purple-700 border-purple-200" },
  IN_PROGRESS: { label: "En cours",   color: "bg-blue-100 text-blue-700",       dot: "bg-blue-500",    cal: "bg-blue-50 text-blue-700 border-blue-200" },
  COMPLETED:   { label: "Terminée",   color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", cal: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED:   { label: "Annulée",    color: "bg-gray-100 text-gray-500",       dot: "bg-gray-400",    cal: "bg-gray-50 text-gray-400 border-gray-200" },
};

const STATUS_TABS = [
  { key: "all",         label: "Toutes" },
  { key: "SCHEDULED",   label: "Planifiées" },
  { key: "READY",       label: "Prêtes" },
  { key: "IN_PROGRESS", label: "En cours" },
  { key: "COMPLETED",   label: "Terminées" },
  { key: "CANCELLED",   label: "Annulées" },
];

const DATE_PRESETS = [
  { key: "all",     label: "Toutes dates" },
  { key: "today",   label: "Aujourd'hui" },
  { key: "week",    label: "Cette semaine" },
  { key: "month",   label: "Ce mois" },
  { key: "3months", label: "3 mois" },
  { key: "custom",  label: "Personnalisé…" },
];

const WEEK_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTonnage(col: CollectionRow) {
  return col.collectionItems.reduce((s, i) => s + i.surplusListing.quantityEstimated, 0);
}

function getCO2(col: CollectionRow) {
  return col.collectionItems.reduce(
    (s, i) => s + i.surplusListing.quantityEstimated * i.surplusListing.material.co2FactorPerUnit * 1000,
    0
  );
}

function getDateRange(
  preset: string,
  customFrom: string,
  customTo: string
): { from: Date; to: Date } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (preset === "all") return null;
  if (preset === "today") return { from: today, to: today };
  if (preset === "week") {
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { from: mon, to: sun };
  }
  if (preset === "month") {
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth() + 1, 0),
    };
  }
  if (preset === "3months") {
    const from = new Date(today);
    from.setMonth(today.getMonth() - 3);
    return { from, to: new Date(today.getFullYear(), today.getMonth() + 1, 0) };
  }
  if (preset === "custom" && customFrom && customTo) {
    return { from: new Date(customFrom), to: new Date(customTo) };
  }
  return null;
}

function exportCSV(collections: CollectionRow[]) {
  const headers = ["Date planifiée", "Statut", "Tonnage (t)", "Partenaires", "Opérateur", "Véhicule", "Nb annonces"];
  const rows = collections.map((col) => {
    const date = new Date(col.scheduledDate).toLocaleDateString("fr-FR");
    const status = STATUS_CONFIG[col.status]?.label ?? col.status;
    const t = getTonnage(col).toFixed(2);
    const partners = [...new Set(col.collectionItems.map((i) => i.surplusListing.partner.name))].join(" | ");
    const operator = col.operator?.name ?? "";
    const vehicle = col.vehicle
      ? `${col.vehicle.name}${col.vehicle.plate ? ` (${col.vehicle.plate})` : ""}`
      : "";
    const items = col.collectionItems.length;
    return [date, status, t, partners, operator, vehicle, items].map((v) => `"${v}"`).join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `collectes_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sort Icon ────────────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active)
    return (
      <svg className="w-3 h-3 text-gray-300 ml-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  return dir === "asc" ? (
    <svg className="w-3 h-3 text-emerald-600 ml-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="w-3 h-3 text-emerald-600 ml-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CollectionsClient({ collections, operators, vehicles, partners }: Props) {
  // ── Filter state ──
  const [statusFilter, setStatusFilter]   = useState("all");
  const [datePreset, setDatePreset]       = useState("all");
  const [customFrom, setCustomFrom]       = useState("");
  const [customTo, setCustomTo]           = useState("");
  const [operatorFilter, setOperatorFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter]   = useState("all");
  const [partnerFilter, setPartnerFilter]   = useState("all");
  const [materialFilter, setMaterialFilter] = useState("all");

  // ── Sort state ──
  const [sortKey, setSortKey] = useState<"date" | "tonnage" | "operator">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ── View state ──
  const [view, setView] = useState<"table" | "calendar">("table");
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // ── Derived: unique materials ──
  const allMaterials = useMemo(() => {
    const seen = new Map<string, string>();
    collections.forEach((col) =>
      col.collectionItems.forEach((i) => {
        const { id, name } = i.surplusListing.material;
        if (!seen.has(id)) seen.set(id, name);
      })
    );
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [collections]);

  // ── Sort handler ──
  const handleSort = useCallback(
    (key: "date" | "tonnage" | "operator") => {
      if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else { setSortKey(key); setSortDir("asc"); }
    },
    [sortKey]
  );

  // ── Filtered + sorted ──
  const filtered = useMemo(() => {
    const range = getDateRange(datePreset, customFrom, customTo);

    let result = collections.filter((col) => {
      if (statusFilter !== "all" && col.status !== statusFilter) return false;

      if (range) {
        const d = new Date(col.scheduledDate);
        d.setHours(12, 0, 0, 0);
        const from = new Date(range.from); from.setHours(0, 0, 0, 0);
        const to   = new Date(range.to);   to.setHours(23, 59, 59, 999);
        if (d < from || d > to) return false;
      }

      if (operatorFilter !== "all" && col.operator?.id !== operatorFilter) return false;
      if (vehicleFilter  !== "all" && col.vehicle?.id  !== vehicleFilter)  return false;
      if (partnerFilter  !== "all" && !col.collectionItems.some((i) => i.surplusListing.partner.id  === partnerFilter))  return false;
      if (materialFilter !== "all" && !col.collectionItems.some((i) => i.surplusListing.material.id === materialFilter)) return false;

      return true;
    });

    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date")     cmp = new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
      if (sortKey === "tonnage")  cmp = getTonnage(a) - getTonnage(b);
      if (sortKey === "operator") cmp = (a.operator?.name ?? "").localeCompare(b.operator?.name ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [collections, statusFilter, datePreset, customFrom, customTo, operatorFilter, vehicleFilter, partnerFilter, materialFilter, sortKey, sortDir]);

  // ── KPIs (on filtered) ──
  const kpis = useMemo(() => ({
    count:     filtered.length,
    tonnage:   filtered.reduce((s, c) => s + getTonnage(c), 0),
    co2:       filtered.filter((c) => c.status === "COMPLETED").reduce((s, c) => s + getCO2(c), 0),
    operators: new Set(filtered.map((c) => c.operator?.id).filter(Boolean)).size,
  }), [filtered]);

  // ── Active filter count ──
  const activeFilters = [statusFilter !== "all", datePreset !== "all", operatorFilter !== "all",
    vehicleFilter !== "all", partnerFilter !== "all", materialFilter !== "all"].filter(Boolean).length;

  const clearFilters = () => {
    setStatusFilter("all"); setDatePreset("all"); setCustomFrom(""); setCustomTo("");
    setOperatorFilter("all"); setVehicleFilter("all"); setPartnerFilter("all"); setMaterialFilter("all");
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Status tabs ── */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {STATUS_TABS.map((tab) => {
          const count = tab.key === "all"
            ? collections.length
            : collections.filter((c) => c.status === tab.key).length;
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isActive ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-gray-100 text-gray-600" : "bg-gray-200 text-gray-500"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Advanced filter bar ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
        {/* Date presets */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-14 shrink-0">Période</span>
          <div className="flex gap-1.5 flex-wrap">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setDatePreset(p.key)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                  datePreset === p.key
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date picker */}
        {datePreset === "custom" && (
          <div className="flex items-center gap-3 pl-[4.25rem]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Du</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">au</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* Other filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-14 shrink-0">Filtrer</span>

          {[
            {
              value: operatorFilter, setter: setOperatorFilter,
              placeholder: "Opérateur",
              options: operators.map((o) => ({ value: o.id, label: o.name })),
            },
            {
              value: vehicleFilter, setter: setVehicleFilter,
              placeholder: "Véhicule",
              options: vehicles.map((v) => ({ value: v.id, label: `${v.name}${v.plate ? ` (${v.plate})` : ""}` })),
            },
            {
              value: partnerFilter, setter: setPartnerFilter,
              placeholder: "Fournisseur",
              options: partners.map((p) => ({ value: p.id, label: p.name })),
            },
            {
              value: materialFilter, setter: setMaterialFilter,
              placeholder: "Matière",
              options: allMaterials.map((m) => ({ value: m.id, label: m.name })),
            },
          ].map(({ value, setter, placeholder, options }) => (
            <div key={placeholder} className="relative">
              <select
                value={value}
                onChange={(e) => setter(e.target.value)}
                className={`appearance-none pl-2.5 pr-7 py-1.5 rounded-lg text-xs font-medium border cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors ${
                  value !== "all"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                <option value="all">{placeholder}</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          ))}

          {activeFilters > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1.5 rounded-lg hover:bg-red-50 transition"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Réinitialiser{activeFilters > 1 ? ` (${activeFilters})` : ""}
            </button>
          )}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { icon: "📦", value: kpis.count.toString(),                                                                         label: "Collectes",       color: "text-gray-900" },
          { icon: "⚖️", value: `${kpis.tonnage.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t`,                   label: "Tonnage total",   color: "text-blue-700" },
          { icon: "🌱", value: `${Math.round(kpis.co2).toLocaleString("fr-FR")} kg`,                                         label: "CO₂ évité",       color: "text-emerald-700" },
          { icon: "👤", value: kpis.operators > 0 ? kpis.operators.toString() : "—",                                         label: "Opérateurs",      color: "text-purple-700" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xl mb-1">{kpi.icon}</p>
            <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* ── Toolbar: count + view toggle + export ── */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">
          {filtered.length} collecte{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-gray-100 p-0.5 rounded-lg">
            {[
              {
                key: "table" as const, label: "Tableau",
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" />,
              },
              {
                key: "calendar" as const, label: "Calendrier",
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
              },
            ].map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  view === v.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">{v.icon}</svg>
                {v.label}
              </button>
            ))}
          </div>

          {/* Export CSV */}
          <button
            onClick={() => exportCSV(filtered)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Table or Calendar ── */}
      {view === "table" ? (
        <TableView
          collections={filtered}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
        />
      ) : (
        <CalendarView
          collections={filtered}
          month={calMonth}
          setMonth={setCalMonth}
        />
      )}
    </div>
  );
}

// ─── Table View ───────────────────────────────────────────────────────────────

function TableView({
  collections,
  sortKey,
  sortDir,
  onSort,
}: {
  collections: CollectionRow[];
  sortKey: string;
  sortDir: "asc" | "desc";
  onSort: (key: "date" | "tonnage" | "operator") => void;
}) {
  if (collections.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
        <p className="text-gray-400 mb-3">Aucune collecte pour ces filtres.</p>
        <Link href="/collections/new" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
          Créer une collecte →
        </Link>
      </div>
    );
  }

  const sortableHeader = (key: "date" | "tonnage" | "operator", label: string, className = "") => (
    <th className={`text-left px-5 py-3 ${className}`}>
      <button
        onClick={() => onSort(key)}
        className="flex items-center text-xs font-medium text-gray-500 uppercase tracking-wide hover:text-gray-800 transition-colors"
      >
        {label}
        <SortIcon active={sortKey === key} dir={sortDir} />
      </button>
    </th>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            {sortableHeader("date", "Date")}
            {sortableHeader("tonnage", "Tonnage")}
            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Annonces</th>
            {sortableHeader("operator", "Opérateur", "hidden md:table-cell")}
            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3 hidden lg:table-cell">Véhicule</th>
            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Statut</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {collections.map((col) => {
            const cfg = STATUS_CONFIG[col.status] ?? STATUS_CONFIG.SCHEDULED;
            const t = getTonnage(col);
            const partners = [...new Set(col.collectionItems.map((i) => i.surplusListing.partner.name))];
            return (
              <tr key={col.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5">
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(col.scheduledDate).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                  {col.actualDate && (
                    <p className="text-xs text-gray-400">
                      Réalisée le {new Date(col.actualDate).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <p className="text-sm font-bold text-gray-900">
                    {t.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t
                  </p>
                </td>
                <td className="px-5 py-3.5">
                  <p className="text-sm font-medium text-gray-700">
                    {col.collectionItems.length} annonce{col.collectionItems.length > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-gray-400 truncate max-w-[160px]">{partners.join(", ")}</p>
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-600 hidden md:table-cell">
                  {col.operator?.name ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-500 hidden lg:table-cell">
                  {col.vehicle
                    ? `${col.vehicle.name}${col.vehicle.plate ? ` (${col.vehicle.plate})` : ""}`
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Link href={`/collections/${col.id}`} className="text-xs font-medium text-emerald-600 hover:text-emerald-700">
                    Voir →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView({
  collections,
  month,
  setMonth,
}: {
  collections: CollectionRow[];
  month: { year: number; month: number };
  setMonth: (m: { year: number; month: number }) => void;
}) {
  const { year, month: monthIdx } = month;
  const firstDay = new Date(year, monthIdx, 1);
  const lastDay  = new Date(year, monthIdx + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
  const totalCells  = startOffset + lastDay.getDate();
  const rows = Math.ceil(totalCells / 7);

  const byDay = useMemo(() => {
    const map = new Map<number, CollectionRow[]>();
    collections.forEach((col) => {
      const d = new Date(col.scheduledDate);
      if (d.getFullYear() === year && d.getMonth() === monthIdx) {
        const day = d.getDate();
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(col);
      }
    });
    return map;
  }, [collections, year, monthIdx]);

  const now = new Date();
  const isToday = (d: number) =>
    now.getFullYear() === year && now.getMonth() === monthIdx && now.getDate() === d;

  const prevMonth = () => monthIdx === 0 ? setMonth({ year: year - 1, month: 11 }) : setMonth({ year, month: monthIdx - 1 });
  const nextMonth = () => monthIdx === 11 ? setMonth({ year: year + 1, month: 0 }) : setMonth({ year, month: monthIdx + 1 });

  const monthLabel = firstDay.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-gray-900 capitalize">{monthLabel}</h3>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
        {WEEK_DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {Array.from({ length: rows * 7 }, (_, i) => {
          const day = i - startOffset + 1;
          const valid = day >= 1 && day <= lastDay.getDate();
          const dayCols = valid ? (byDay.get(day) ?? []) : [];
          const today = valid && isToday(day);

          return (
            <div
              key={i}
              className={`border-b border-r border-gray-100 p-1.5 min-h-[110px] ${
                !valid ? "bg-gray-50/40" : today ? "bg-emerald-50/30" : ""
              }`}
            >
              {valid && (
                <>
                  <span className={`inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full mb-1 ${
                    today ? "bg-emerald-600 text-white" : "text-gray-500"
                  }`}>
                    {day}
                  </span>
                  <div className="space-y-0.5">
                    {dayCols.map((col) => {
                      const cfg = STATUS_CONFIG[col.status];
                      const t = getTonnage(col);
                      return (
                        <Link
                          key={col.id}
                          href={`/collections/${col.id}`}
                          className={`block text-xs font-medium px-1.5 py-1 rounded border hover:opacity-75 transition ${cfg?.cal ?? "bg-gray-100 text-gray-600 border-gray-200"}`}
                        >
                          {/* Ligne 1 : statut dot + tonnage + nb annonces */}
                          <div className="flex items-center gap-1 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg?.dot}`} />
                            <span className="font-semibold truncate">{t.toFixed(1)} t</span>
                            <span className="opacity-60 shrink-0">· {col.collectionItems.length} arr.</span>
                          </div>
                          {/* Ligne 2 : partenaire(s) */}
                          {(() => {
                            const names = [...new Set(col.collectionItems.map((i) => i.surplusListing.partner.name))];
                            return (
                              <p className="truncate opacity-70 mt-0.5 leading-tight">
                                {names.join(", ")}
                              </p>
                            );
                          })()}
                          {/* Ligne 3 : opérateur (si présent) */}
                          {col.operator && (
                            <p className="truncate opacity-60 leading-tight">
                              👤 {col.operator.name}
                            </p>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
