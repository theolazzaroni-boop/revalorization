import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const STATUS_CONFIG = {
  SUBMITTED:  { label: "Nouvelle",   color: "bg-blue-100 text-blue-700",    dot: "bg-blue-500" },
  SCHEDULED:  { label: "Planifiée",  color: "bg-amber-100 text-amber-700",  dot: "bg-amber-500" },
  COLLECTED:  { label: "Collectée",  color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  CANCELLED:  { label: "Annulée",    color: "bg-gray-100 text-gray-500",    dot: "bg-gray-400" },
  DRAFT:      { label: "Brouillon",  color: "bg-gray-100 text-gray-500",    dot: "bg-gray-300" },
} as const;

const CATEGORY_ICONS: Record<string, string> = {
  PLASTIC: "♻️", METAL: "⚙️", WOOD: "🪵", ELECTRONIC: "💻",
  PAPER: "📦", GLASS: "🔷", TEXTILE: "👕", OTHER: "🗃️",
};

const FILTERS = [
  { key: "all",       label: "Toutes" },
  { key: "SUBMITTED", label: "Nouvelles" },
  { key: "SCHEDULED", label: "Planifiées" },
  { key: "COLLECTED", label: "Collectées" },
  { key: "CANCELLED", label: "Annulées" },
];

async function getTenantId(email: string | undefined) {
  if (!email) return null;
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) return user.tenantId;
  // Dev fallback : premier tenant
  const tenant = await prisma.tenant.findFirst();
  return tenant?.id ?? null;
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;

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

  const where = {
    tenantId,
    ...(statusFilter && statusFilter !== "all" ? { status: statusFilter as never } : {}),
  };

  const [listings, counts] = await Promise.all([
    prisma.surplusListing.findMany({
      where,
      include: {
        partner: { select: { name: true } },
        material: { select: { category: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.surplusListing.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: true,
    }),
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count]));
  const totalCount = Object.values(countMap).reduce((a, b) => a + b, 0);

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Annonces de surplus</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalCount} demande{totalCount > 1 ? "s" : ""} au total
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {FILTERS.map((f) => {
          const count = f.key === "all" ? totalCount : (countMap[f.key] ?? 0);
          const isActive = (statusFilter ?? "all") === f.key;
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? "/listings" : `/listings?status=${f.key}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-gray-100 text-gray-600" : "bg-gray-200 text-gray-500"
                }`}>
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Table */}
      {listings.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-400">Aucune annonce{statusFilter && statusFilter !== "all" ? " pour ce filtre" : ""}.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Matière</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Fournisseur</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Quantité</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3 hidden md:table-cell">Adresse</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3 hidden lg:table-cell">Date souhaitée</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Statut</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {listings.map((listing) => {
                const config = STATUS_CONFIG[listing.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.DRAFT;
                const icon = CATEGORY_ICONS[listing.material.category] ?? "🗃️";
                return (
                  <tr key={listing.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{icon}</span>
                        <span className="text-sm font-medium text-gray-900">{listing.material.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{listing.partner.name}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-900 font-medium">
                      {listing.quantityEstimated} t
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 hidden md:table-cell max-w-[180px] truncate">
                      {listing.locationAddress}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 hidden lg:table-cell">
                      {listing.preferredDate
                        ? new Date(listing.preferredDate).toLocaleDateString("fr-FR")
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${config.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                        {config.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/listings/${listing.id}`}
                        className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        Voir →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
