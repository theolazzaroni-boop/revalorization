import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import CollectionActions from "./CollectionActions";

const STATUS_CONFIG = {
  SCHEDULED:   { label: "Planifiée",    color: "bg-amber-100 text-amber-700",     dot: "bg-amber-500" },
  READY:       { label: "Prête",        color: "bg-purple-100 text-purple-700",   dot: "bg-purple-500" },
  IN_PROGRESS: { label: "En cours",     color: "bg-blue-100 text-blue-700",       dot: "bg-blue-500" },
  COMPLETED:   { label: "Terminée",     color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  CANCELLED:   { label: "Annulée",      color: "bg-gray-100 text-gray-500",       dot: "bg-gray-400" },
} as const;

const LISTING_STATUS_CONFIG = {
  SCHEDULED:  { label: "Planifiée",  color: "bg-amber-100 text-amber-700" },
  COLLECTED:  { label: "Collectée",  color: "bg-emerald-100 text-emerald-700" },
  CANCELLED:  { label: "Annulée",    color: "bg-gray-100 text-gray-500" },
} as const;

const CATEGORY_ICONS: Record<string, string> = {
  PLASTIC: "♻️", METAL: "⚙️", WOOD: "🪵", ELECTRONIC: "💻",
  PAPER: "📦", GLASS: "🔷", TEXTILE: "👕", OTHER: "🗃️",
};

const EVENT_LABELS: Record<string, string> = {
  SCHEDULED: "Collecte planifiée",
  READY:     "Collecte marquée prête",
  COLLECTED: "Collecte terminée",
};

async function getTenantId(email: string | undefined) {
  if (!email) return null;
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) return user.tenantId;
  const tenant = await prisma.tenant.findFirst();
  return tenant?.id ?? null;
}

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const tenantId = await getTenantId(user?.email);

  const collection = await prisma.collection.findFirst({
    where: { id, ...(tenantId ? { tenantId } : {}) },
    include: {
      operator: { select: { name: true, email: true } },
      vehicle:  { select: { name: true, plate: true } },
      collectionItems: {
        include: {
          surplusListing: {
            include: {
              partner: { select: { name: true } },
              material: { select: { name: true, category: true } },
            },
          },
        },
      },
    },
  });

  if (!collection) notFound();

  const traceEvents = await prisma.traceEvent.findMany({
    where: { entityType: "COLLECTION", entityId: id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true } } },
  });

  const statusCfg = STATUS_CONFIG[collection.status as keyof typeof STATUS_CONFIG];
  const totalTonnes = collection.collectionItems.reduce(
    (sum, item) => sum + item.surplusListing.quantityEstimated, 0
  );

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/collections" className="hover:text-gray-700 transition-colors">Collectes</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">
          {new Date(collection.scheduledDate).toLocaleDateString("fr-FR", {
            day: "numeric", month: "long", year: "numeric",
          })}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Collecte du {new Date(collection.scheduledDate).toLocaleDateString("fr-FR", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {collection.collectionItems.length} annonce{collection.collectionItems.length > 1 ? "s" : ""} · {totalTonnes} t estimées
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${statusCfg.color}`}>
          <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
          {statusCfg.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Infos collecte */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Détails</h2>
          <dl className="space-y-3">
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Date planifiée</dt>
              <dd className="font-medium text-gray-900">
                {new Date(collection.scheduledDate).toLocaleDateString("fr-FR")}
              </dd>
            </div>
            {collection.actualDate && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Date réelle</dt>
                <dd className="font-medium text-gray-900">
                  {new Date(collection.actualDate).toLocaleDateString("fr-FR")}
                </dd>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Opérateur</dt>
              <dd className="text-gray-900">{collection.operator?.name ?? <span className="text-gray-300">—</span>}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Véhicule</dt>
              <dd className="text-gray-900">
                {collection.vehicle
                  ? `${collection.vehicle.name}${collection.vehicle.plate ? ` (${collection.vehicle.plate})` : ""}`
                  : <span className="text-gray-300">—</span>}
              </dd>
            </div>
          </dl>
          {collection.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-700">{collection.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Actions</h2>
          <div className="space-y-3">
            {(collection.status === "SCHEDULED" || collection.status === "READY") && (
              <Link
                href={`/collections/${collection.id}/preparation`}
                className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100 transition"
              >
                <span>📋 Préparer la tournée</span>
                <span className="text-xs opacity-60">→</span>
              </Link>
            )}
            <CollectionActions collectionId={collection.id} status={collection.status} />
          </div>
          {(collection.status === "COMPLETED" || collection.status === "CANCELLED") && (
            <p className="text-sm text-gray-400 mt-2">
              {collection.status === "COMPLETED"
                ? "Collecte terminée. Les annonces liées ont été marquées comme collectées."
                : "Cette collecte a été annulée."}
            </p>
          )}
        </div>
      </div>

      {/* Annonces liées */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Annonces incluses</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Matière</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Fournisseur</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Quantité</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Statut</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {collection.collectionItems.map((item) => {
              const listing = item.surplusListing;
              const icon = CATEGORY_ICONS[listing.material.category] ?? "🗃️";
              const lCfg = LISTING_STATUS_CONFIG[listing.status as keyof typeof LISTING_STATUS_CONFIG];
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span>{icon}</span>
                      <span className="text-sm font-medium text-gray-900">{listing.material.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{listing.partner.name}</td>
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">
                    {listing.quantityEstimated} t
                  </td>
                  <td className="px-5 py-3">
                    {lCfg && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${lCfg.color}`}>
                        {lCfg.label}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/listings/${listing.id}`} className="text-xs text-emerald-600 hover:text-emerald-700">
                      Voir →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
