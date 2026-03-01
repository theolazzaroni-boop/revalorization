import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import ListingActions from "./ListingActions";

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
};

async function getTenantId(email: string | undefined) {
  if (!email) return null;
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) return user.tenantId;
  const tenant = await prisma.tenant.findFirst();
  return tenant?.id ?? null;
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const tenantId = await getTenantId(user?.email);

  const listing = await prisma.surplusListing.findFirst({
    where: { id, ...(tenantId ? { tenantId } : {}) },
    include: {
      partner: { select: { name: true, address: true, contactEmail: true, contactPhone: true } },
      material: { select: { name: true, category: true, unit: true } },
    },
  });

  if (!listing) notFound();

  const traceEvents = await prisma.traceEvent.findMany({
    where: { entityType: "SURPLUS_LISTING", entityId: id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true } } },
  });

  const statusCfg = STATUS_CONFIG[listing.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.DRAFT;
  const icon = CATEGORY_ICONS[listing.material.category] ?? "🗃️";

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/listings" className="hover:text-gray-700 transition-colors">
          Annonces de surplus
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{listing.partner.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">{icon}</span>
            <h1 className="text-2xl font-bold text-gray-900">{listing.material.name}</h1>
          </div>
          <p className="text-sm text-gray-500">Soumis le {new Date(listing.createdAt).toLocaleDateString("fr-FR")}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${statusCfg.color}`}>
          <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
          {statusCfg.label}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Infos matière */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Matière</h2>
          <dl className="space-y-3">
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Quantité estimée</dt>
              <dd className="font-semibold text-gray-900">
                {listing.quantityEstimated} {listing.material.unit.toLowerCase()}
              </dd>
            </div>
            {listing.condition && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">État</dt>
                <dd className="text-gray-900">{listing.condition}</dd>
              </div>
            )}
            {listing.preferredDate && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Date souhaitée</dt>
                <dd className="text-gray-900">
                  {new Date(listing.preferredDate).toLocaleDateString("fr-FR")}
                </dd>
              </div>
            )}
            {listing.locationAddress && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Adresse</dt>
                <dd className="text-gray-900 text-right max-w-[180px]">{listing.locationAddress}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Infos fournisseur */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Fournisseur</h2>
          <dl className="space-y-3">
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Nom</dt>
              <dd className="font-semibold text-gray-900">{listing.partner.name}</dd>
            </div>
            {listing.partner.contactEmail && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-900">{listing.partner.contactEmail}</dd>
              </div>
            )}
            {listing.partner.contactPhone && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Téléphone</dt>
                <dd className="text-gray-900">{listing.partner.contactPhone}</dd>
              </div>
            )}
            {listing.partner.address && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Siège</dt>
                <dd className="text-gray-900 text-right max-w-[180px]">{listing.partner.address}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Description */}
      {listing.description && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Description</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{listing.description}</p>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <ListingActions listingId={listing.id} status={listing.status} />
          {listing.status === "SCHEDULED" && (
            <Link
              href={`/collections/new?listingId=${listing.id}`}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition"
            >
              📅 Planifier une collecte
            </Link>
          )}
        </div>
      </div>

      {/* Historique */}
      {traceEvents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Historique</h2>
          <ol className="relative border-l border-gray-200 space-y-4 pl-5">
            {traceEvents.map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                <p className="text-sm font-medium text-gray-900">
                  {EVENT_LABELS[event.eventType] ?? event.eventType}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(event.createdAt).toLocaleString("fr-FR")}
                  {event.user && ` · ${event.user.name}`}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
