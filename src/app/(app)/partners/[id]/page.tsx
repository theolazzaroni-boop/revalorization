import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

const CATEGORY_ICONS: Record<string, string> = {
  PLASTIC: "♻️", METAL: "⚙️", WOOD: "🪵", ELECTRONIC: "💻",
  PAPER: "📦", GLASS: "🔷", TEXTILE: "👕", OTHER: "🗃️",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  DRAFT:      { label: "Brouillon",  color: "bg-gray-100 text-gray-500",       dot: "bg-gray-400"    },
  SUBMITTED:  { label: "Envoyée",    color: "bg-blue-100 text-blue-700",        dot: "bg-blue-500"    },
  SCHEDULED:  { label: "Planifiée",  color: "bg-amber-100 text-amber-700",      dot: "bg-amber-500"   },
  COLLECTED:  { label: "Collectée",  color: "bg-emerald-100 text-emerald-700",  dot: "bg-emerald-500" },
  CANCELLED:  { label: "Annulée",    color: "bg-red-100 text-red-600",          dot: "bg-red-400"     },
};

const TYPE_LABELS: Record<string, string> = {
  SUPPLIER: "Cédant", BUYER: "Acheteur", BOTH: "Cédant & Acheteur",
};

async function getTenantId(email: string | undefined) {
  if (!email) return null;
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) return user.tenantId;
  const tenant = await prisma.tenant.findFirst();
  return tenant?.id ?? null;
}

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const tenantId = await getTenantId(user?.email);

  const partner = await prisma.partner.findFirst({
    where: { id, ...(tenantId ? { tenantId } : {}) },
    include: {
      tenant: { select: { name: true } },
      surplusListings: {
        orderBy: { createdAt: "desc" },
        include: {
          material: { select: { name: true, category: true, co2FactorPerUnit: true, unit: true } },
          collectionItems: {
            include: {
              collection: { select: { scheduledDate: true, status: true, id: true } },
            },
          },
        },
      },
    },
  });

  if (!partner) notFound();

  // Impact stats
  const collectedListings = partner.surplusListings.filter((l) => l.status === "COLLECTED");
  const tonnesCollected   = collectedListings.reduce((s, l) => s + l.quantityEstimated, 0);
  const co2Avoided        = collectedListings.reduce(
    (s, l) => s + l.quantityEstimated * l.material.co2FactorPerUnit * 1000, 0
  );

  const statusCounts = partner.surplusListings.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeCount = (statusCounts.SUBMITTED ?? 0) + (statusCounts.SCHEDULED ?? 0);

  const nextCollection = partner.surplusListings
    .filter((l) => l.status === "SCHEDULED")
    .flatMap((l) => l.collectionItems.map((ci) => ci.collection))
    .filter((c) => c && !["COMPLETED", "CANCELLED"].includes(c.status))
    .sort((a, b) => new Date(a!.scheduledDate).getTime() - new Date(b!.scheduledDate).getTime())[0];

  const portalUrl = partner.portalToken
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL ? "" : ""}/portal/${partner.portalToken}`
    : null;

  const isSupplier = partner.type === "SUPPLIER" || partner.type === "BOTH";

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/partners" className="hover:text-gray-700 transition-colors">Partenaires</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{partner.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-2xl font-bold text-emerald-600">
            {partner.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{partner.name}</h1>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                {TYPE_LABELS[partner.type] ?? partner.type}
              </span>
              {partner.userId && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Portail actif
                </span>
              )}
              {!partner.userId && partner.portalToken && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Invité
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {partner.tenant.name}
              {partner.siret && ` · SIRET ${partner.siret}`}
            </p>
          </div>
        </div>

        {/* Portal link for admin */}
        {partner.portalToken && (
          <Link
            href={`/portal/${partner.portalToken}`}
            target="_blank"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium hover:bg-emerald-100 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Ouvrir le portail
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Contact info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Contact</h2>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-gray-900">{partner.contactEmail ?? partner.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Téléphone</dt>
              <dd className="font-medium text-gray-900">{partner.contactPhone ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Adresse</dt>
              <dd className="font-medium text-gray-900 text-right max-w-[200px]">{partner.address ?? "—"}</dd>
            </div>
            {partner.siret && (
              <div className="flex justify-between">
                <dt className="text-gray-500">SIRET</dt>
                <dd className="font-medium text-gray-900 font-mono text-xs">{partner.siret}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Portal access */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Accès portail</h2>
          {partner.portalToken ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${partner.userId ? "bg-emerald-500" : "bg-amber-500"}`} />
                <p className="text-sm font-medium text-gray-900">
                  {partner.userId ? "Compte activé" : "Invitation en attente"}
                </p>
              </div>
              {partner.email && (
                <p className="text-xs text-gray-500">Compte : {partner.email}</p>
              )}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Lien d'invitation</p>
                <p className="text-xs font-mono text-gray-700 break-all">
                  {`/portal/${partner.portalToken}`}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Aucun lien d'invitation configuré.</p>
          )}
        </div>
      </div>

      {/* Vue portail — only for suppliers */}
      {isSupplier && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Vue fournisseur</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Ce que voit le fournisseur</span>
          </div>

          {/* Impact banner */}
          {tonnesCollected > 0 ? (
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 mb-4 text-white">
              <p className="text-xs font-medium text-emerald-100 mb-3">🌱 Impact environnemental</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-2xl font-bold">
                    {tonnesCollected.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t
                  </p>
                  <p className="text-xs text-emerald-100">valorisées</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{Math.round(co2Avoided).toLocaleString("fr-FR")} kg</p>
                  <p className="text-xs text-emerald-100">CO₂ évités</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{Math.round(co2Avoided / 120).toLocaleString("fr-FR")}</p>
                  <p className="text-xs text-emerald-100">km voiture évités</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl p-5 mb-4 border border-dashed border-gray-200 text-center">
              <p className="text-sm text-gray-400">Aucune collecte réalisée pour l'instant.</p>
            </div>
          )}

          {/* Next collection */}
          {nextCollection && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-3">
              <span className="text-xl">📅</span>
              <div>
                <p className="text-xs font-semibold text-amber-900">Prochaine collecte</p>
                <p className="text-sm text-amber-700">
                  {new Date(nextCollection.scheduledDate).toLocaleDateString("fr-FR", {
                    weekday: "long", day: "numeric", month: "long",
                  })}
                </p>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{partner.surplusListings.length}</p>
              <p className="text-xs text-gray-500">Demandes</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-xl font-bold text-amber-600">{activeCount}</p>
              <p className="text-xs text-gray-500">En cours</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-xl font-bold text-emerald-600">{statusCounts.COLLECTED ?? 0}</p>
              <p className="text-xs text-gray-500">Collectées</p>
            </div>
          </div>

          {/* Listings */}
          {partner.surplusListings.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm">Aucune demande pour le moment.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Demandes de collecte</h3>
                <Link href={`/listings?partner=${partner.id}`} className="text-xs text-emerald-600 hover:text-emerald-700">
                  Voir dans Annonces →
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {partner.surplusListings.map((listing) => {
                  const cfg  = STATUS_CONFIG[listing.status] ?? STATUS_CONFIG.DRAFT;
                  const icon = CATEGORY_ICONS[listing.material.category] ?? "🗃️";
                  const scheduledDate = listing.collectionItems[0]?.collection?.scheduledDate;
                  const co2Single = listing.status === "COLLECTED"
                    ? Math.round(listing.quantityEstimated * listing.material.co2FactorPerUnit * 1000)
                    : null;

                  return (
                    <Link
                      key={listing.id}
                      href={`/listings/${listing.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition group"
                    >
                      <span className="text-xl shrink-0">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 group-hover:text-emerald-700 transition-colors">
                          {listing.material.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {listing.quantityEstimated} t
                          {listing.locationAddress && ` · ${listing.locationAddress}`}
                        </p>
                        {scheduledDate && listing.status === "SCHEDULED" && (
                          <p className="text-xs text-amber-600 mt-0.5 font-medium">
                            📅 {new Date(scheduledDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </p>
                        )}
                        {co2Single && (
                          <p className="text-xs text-emerald-600 mt-0.5 font-medium">
                            ✓ {co2Single.toLocaleString("fr-FR")} kg CO₂ évités
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(listing.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
