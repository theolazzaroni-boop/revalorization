import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ListingsChart from "./ListingsChart";

const STATUS_CONFIG = {
  SUBMITTED:  { label: "Nouvelle",   color: "bg-blue-100 text-blue-700",       dot: "bg-blue-500" },
  SCHEDULED:  { label: "Planifiée",  color: "bg-amber-100 text-amber-700",     dot: "bg-amber-500" },
  COLLECTED:  { label: "Collectée",  color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  CANCELLED:  { label: "Annulée",    color: "bg-gray-100 text-gray-500",       dot: "bg-gray-400" },
  DRAFT:      { label: "Brouillon",  color: "bg-gray-100 text-gray-500",       dot: "bg-gray-300" },
} as const;

const CATEGORY_ICONS: Record<string, string> = {
  PLASTIC: "♻️", METAL: "⚙️", WOOD: "🪵", ELECTRONIC: "💻",
  PAPER: "📦", GLASS: "🔷", TEXTILE: "👕", OTHER: "🗃️",
};

const EVENT_LABELS: Record<string, string> = {
  SUBMITTED:  "Demande soumise",
  SCHEDULED:  "Collecte planifiée",
  COLLECTED:  "Collectée",
  RECEIVED:   "Lot réceptionné",
  SOLD:       "Vendu",
};

async function getTenantId(email: string | undefined) {
  if (!email) return null;
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) return user.tenantId;
  const tenant = await prisma.tenant.findFirst();
  return tenant?.id ?? null;
}

function getWeekLabel(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const tenantId = await getTenantId(user?.email);

  if (!tenantId) {
    return (
      <div className="p-8 text-center text-gray-500">
        Aucun tenant configuré. Lancez le seed via <code className="text-xs bg-gray-100 px-1 rounded">/api/dev/seed</code>.
      </div>
    );
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);

  const [
    pendingCount,
    collectedListings,
    revenueAgg,
    recentListings,
    recentEvents,
    chartListings,
  ] = await Promise.all([
    prisma.surplusListing.count({ where: { tenantId, status: "SUBMITTED" } }),
    prisma.surplusListing.findMany({
      where: { tenantId, status: "COLLECTED", updatedAt: { gte: startOfMonth } },
      select: { quantityEstimated: true },
    }),
    prisma.saleOrder.aggregate({
      where: { tenantId, status: { in: ["CONFIRMED", "DELIVERED"] } },
      _sum: { totalPrice: true },
    }),
    prisma.surplusListing.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        partner: { select: { name: true } },
        material: { select: { name: true, category: true } },
      },
    }),
    prisma.traceEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        user: { select: { name: true } },
        partner: { select: { name: true } },
      },
    }),
    prisma.surplusListing.findMany({
      where: { tenantId, createdAt: { gte: eightWeeksAgo } },
      select: { createdAt: true, status: true },
    }),
  ]);

  const tonnesCollectees = collectedListings.reduce((sum, l) => sum + l.quantityEstimated, 0);
  const ca = revenueAgg._sum.totalPrice ?? 0;

  // Graphique : grouper par semaine
  const weekMap: Record<string, { Nouvelles: number; Planifiées: number; Collectées: number; Annulées: number }> = {};
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    weekMap[getWeekLabel(d)] = { Nouvelles: 0, Planifiées: 0, Collectées: 0, Annulées: 0 };
  }
  const STATUS_TO_KEY: Record<string, keyof (typeof weekMap)[string]> = {
    SUBMITTED: "Nouvelles", DRAFT: "Nouvelles",
    SCHEDULED: "Planifiées",
    COLLECTED: "Collectées",
    CANCELLED: "Annulées",
  };
  for (const l of chartListings) {
    const key = getWeekLabel(l.createdAt);
    const col = STATUS_TO_KEY[l.status];
    if (weekMap[key] && col) weekMap[key][col]++;
  }
  const chartData = Object.entries(weekMap).map(([week, counts]) => ({ week, ...counts }));

  const kpis = [
    {
      label: "En attente",
      value: pendingCount,
      sub: "annonce" + (pendingCount > 1 ? "s" : "") + " à traiter",
      color: "text-blue-600",
      bg: "bg-blue-50",
      icon: "📋",
      href: "/listings?status=SUBMITTED",
    },
    {
      label: "Collectées ce mois",
      value: `${tonnesCollectees.toLocaleString("fr-FR")} t`,
      sub: "tonnes valorisées",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      icon: "♻️",
      href: "/listings?status=COLLECTED",
    },
    {
      label: "Chiffre d'affaires",
      value: ca > 0 ? `${ca.toLocaleString("fr-FR")} €` : "—",
      sub: "commandes confirmées",
      color: "text-violet-600",
      bg: "bg-violet-50",
      icon: "💶",
      href: "/orders",
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Vue d'ensemble</h1>
        <p className="text-sm text-gray-500 mt-1 capitalize">
          {now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors"
          >
            <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center mb-3 text-lg`}>
              {kpi.icon}
            </div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{kpi.label}</p>
            <p className={`text-3xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
          </Link>
        ))}
      </div>

      {/* Graphique */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-0.5">Annonces par semaine</h2>
        <p className="text-xs text-gray-400 mb-4">8 dernières semaines · par statut à la création</p>
        <ListingsChart data={chartData} />
      </div>

      {/* Activité */}
      <div className="grid grid-cols-2 gap-6">
        {/* Dernières annonces */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Dernières annonces</h2>
            <Link href="/listings" className="text-xs text-emerald-600 hover:text-emerald-700">
              Voir tout →
            </Link>
          </div>
          {recentListings.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Aucune annonce</p>
          ) : (
            <ul className="space-y-3">
              {recentListings.map((listing) => {
                const cfg = STATUS_CONFIG[listing.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.DRAFT;
                const icon = CATEGORY_ICONS[listing.material.category] ?? "🗃️";
                return (
                  <li key={listing.id}>
                    <Link href={`/listings/${listing.id}`} className="flex items-center justify-between group">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base shrink-0">{icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
                            {listing.material.name}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{listing.partner.name}</p>
                        </div>
                      </div>
                      <span className={`ml-3 shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Activité récente */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Activité récente</h2>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Aucune activité</p>
          ) : (
            <ol className="relative border-l border-gray-100 space-y-3 pl-4">
              {recentEvents.map((event) => {
                const actor = event.user?.name ?? event.partner?.name ?? "Système";
                return (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
                    <p className="text-sm text-gray-900 font-medium leading-tight">
                      {EVENT_LABELS[event.eventType] ?? event.eventType}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(event.createdAt).toLocaleString("fr-FR", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                      {" · "}{actor}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
