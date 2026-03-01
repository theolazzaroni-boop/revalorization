import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

const STATUS_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  DRAFT:      { label: "Brouillon",  color: "bg-gray-100 text-gray-600",       dot: "bg-gray-400" },
  SUBMITTED:  { label: "Envoyée",    color: "bg-blue-100 text-blue-700",        dot: "bg-blue-500" },
  SCHEDULED:  { label: "Planifiée",  color: "bg-amber-100 text-amber-700",      dot: "bg-amber-500" },
  COLLECTED:  { label: "Collectée",  color: "bg-emerald-100 text-emerald-700",  dot: "bg-emerald-500" },
  CANCELLED:  { label: "Annulée",    color: "bg-red-100 text-red-600",          dot: "bg-red-400" },
};

const CATEGORY_ICONS: Record<string, string> = {
  PLASTIC: "♻️", METAL: "⚙️", WOOD: "🪵", ELECTRONIC: "💻",
  PAPER: "📦", GLASS: "🔷", TEXTILE: "👕", OTHER: "🗃️",
};

export default async function PortalDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/portal/login");

  const partner = await prisma.partner.findUnique({
    where: { userId: user.id },
    include: {
      tenant: { select: { name: true } },
      surplusListings: {
        orderBy: { createdAt: "desc" },
        include: {
          material: { select: { category: true, name: true, co2FactorPerUnit: true, unit: true } },
          collectionItems: {
            include: {
              collection: { select: { scheduledDate: true, status: true, id: true } },
            },
          },
        },
      },
    },
  });

  if (!partner) redirect("/portal/login");

  // Impact calculations
  const collectedListings = partner.surplusListings.filter((l) => l.status === "COLLECTED");
  const tonnesCollected = collectedListings.reduce((s, l) => s + l.quantityEstimated, 0);
  const co2Avoided = collectedListings.reduce(
    (s, l) => s + l.quantityEstimated * l.material.co2FactorPerUnit * 1000,
    0
  );

  // Status counts
  const statusCounts = partner.surplusListings.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Next upcoming collection
  const nextCollection = partner.surplusListings
    .filter((l) => l.status === "SCHEDULED")
    .flatMap((l) => l.collectionItems.map((ci) => ci.collection))
    .filter((c) => c && !["COMPLETED", "CANCELLED"].includes(c.status))
    .sort((a, b) => new Date(a!.scheduledDate).getTime() - new Date(b!.scheduledDate).getTime())[0];

  const activeCount = (statusCounts.SUBMITTED || 0) + (statusCounts.SCHEDULED || 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-0.5">
          Service de <span className="font-medium">{partner.tenant.name}</span>
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Bonjour, {partner.name} 👋</h1>
      </div>

      {/* Impact card — shown only once something has been collected */}
      {tonnesCollected > 0 && (
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 mb-6 text-white shadow-sm">
          <p className="text-sm font-medium text-emerald-100 mb-4">🌱 Votre impact environnemental</p>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-3xl font-bold">
                {tonnesCollected.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t
              </p>
              <p className="text-sm text-emerald-100 mt-0.5">de matières valorisées</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{Math.round(co2Avoided).toLocaleString("fr-FR")} kg</p>
              <p className="text-sm text-emerald-100 mt-0.5">de CO₂ évités</p>
            </div>
          </div>
          <p className="text-xs text-emerald-200 mt-4">
            Équivalent à {Math.round(co2Avoided / 120)} km parcourus en voiture évités 🚗
          </p>
        </div>
      )}

      {/* Next collection notice */}
      {nextCollection && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <span className="text-2xl">📅</span>
          <div>
            <p className="text-sm font-medium text-amber-900">Prochaine collecte prévue</p>
            <p className="text-sm text-amber-700">
              {new Date(nextCollection.scheduledDate).toLocaleDateString("fr-FR", {
                weekday: "long", day: "numeric", month: "long",
              })}
            </p>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{partner.surplusListings.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Demandes totales</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{activeCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">En cours</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{statusCounts.COLLECTED || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Collectées</p>
        </div>
      </div>

      {/* CTA */}
      <Link
        href="/portal/dashboard/new"
        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition mb-8 shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Nouvelle demande de collecte
      </Link>

      {/* Listing list */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Mes demandes</h2>

        {partner.surplusListings.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <p className="text-4xl mb-3">♻️</p>
            <p className="text-gray-400 text-sm">Aucune demande pour le moment.</p>
            <p className="text-gray-400 text-xs mt-1">Créez votre première demande ci-dessus.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {partner.surplusListings.map((listing) => {
              const status = STATUS_LABELS[listing.status] ?? {
                label: listing.status, color: "bg-gray-100 text-gray-600", dot: "bg-gray-400",
              };
              const icon = CATEGORY_ICONS[listing.material.category] ?? "🗃️";
              const scheduledCollection = listing.collectionItems[0]?.collection;

              return (
                <Link
                  key={listing.id}
                  href={`/portal/dashboard/listing/${listing.id}`}
                  className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-emerald-300 hover:shadow-sm transition group"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-emerald-700 transition-colors">
                        {listing.material.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {listing.quantityEstimated} t
                        {listing.locationAddress && ` · ${listing.locationAddress}`}
                      </p>
                      {scheduledCollection && listing.status === "SCHEDULED" && (
                        <p className="text-xs text-amber-600 mt-1 font-medium">
                          📅 Collecte prévue le{" "}
                          {new Date(scheduledCollection.scheduledDate).toLocaleDateString("fr-FR", {
                            day: "numeric", month: "short",
                          })}
                        </p>
                      )}
                      {listing.status === "COLLECTED" && (
                        <p className="text-xs text-emerald-600 mt-1 font-medium">
                          ✓{" "}
                          {Math.round(
                            listing.quantityEstimated * listing.material.co2FactorPerUnit * 1000
                          ).toLocaleString("fr-FR")}{" "}
                          kg CO₂ évités
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(listing.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
