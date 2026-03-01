import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StopsManager from "./StopsManager";
import ChecklistManager from "./ChecklistManager";
import PrepActions from "./PrepActions";
import PrintButton from "./PrintButton";

const STATUS_CONFIG = {
  SCHEDULED:   { label: "Planifiée",  color: "bg-amber-100 text-amber-700",     dot: "bg-amber-500" },
  READY:       { label: "Prête",      color: "bg-purple-100 text-purple-700",   dot: "bg-purple-500" },
  IN_PROGRESS: { label: "En cours",   color: "bg-blue-100 text-blue-700",       dot: "bg-blue-500" },
  COMPLETED:   { label: "Terminée",   color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  CANCELLED:   { label: "Annulée",    color: "bg-gray-100 text-gray-500",       dot: "bg-gray-400" },
} as const;

const MATERIAL_ICONS: Record<string, string> = {
  PLASTIC: "🧴", METAL: "⚙️", WOOD: "🪵", ELECTRONIC: "💻",
  PAPER: "📄", GLASS: "🪟", TEXTILE: "👕", OTHER: "🗃️",
};

async function getTenantId(email: string | undefined) {
  if (!email) return null;
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) return user.tenantId;
  const tenant = await prisma.tenant.findFirst();
  return tenant?.id ?? null;
}

export default async function PreparationDetailPage({
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
      vehicle:  { select: { name: true, plate: true, type: true } },
      collectionItems: {
        orderBy: { order: "asc" },
        include: {
          surplusListing: {
            include: {
              partner:  { select: { name: true, contactPhone: true, address: true } },
              material: { select: { name: true, category: true, unit: true } },
            },
          },
        },
      },
      checklistItems: { orderBy: { order: "asc" } },
    },
  });

  if (!collection) notFound();

  const cfg = STATUS_CONFIG[collection.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.SCHEDULED;
  const canEdit = collection.status === "SCHEDULED" || collection.status === "READY";

  const stops = collection.collectionItems.map((item) => ({
    id: item.id,
    order: item.order,
    note: item.note,
    scheduledTime: item.scheduledTime,
    partner: item.surplusListing.partner.name,
    phone: item.surplusListing.partner.contactPhone,
    address: item.surplusListing.partner.address ?? item.surplusListing.locationAddress ?? "",
    material: item.surplusListing.material.name,
    materialCategory: item.surplusListing.material.category,
    quantity: item.surplusListing.quantityEstimated,
    unit: item.surplusListing.material.unit,
    condition: item.surplusListing.condition,
    listingId: item.surplusListing.id,
  }));

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/collections" className="hover:text-gray-700 transition-colors">Collectes</Link>
        <span>/</span>
        <Link href="/collections/preparation" className="hover:text-gray-700 transition-colors">Planification</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Préparation</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              Collecte du {new Date(collection.scheduledDate).toLocaleDateString("fr-FR", {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
              })}
            </h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {stops.length} arrêt{stops.length > 1 ? "s" : ""}
            {collection.operator && ` · ${collection.operator.name}`}
            {collection.vehicle && ` · ${collection.vehicle.name}`}
          </p>
        </div>

        {/* Lien retour + print */}
        <div className="flex items-center gap-2 print:hidden">
          <Link
            href={`/collections/${id}`}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            ← Fiche collecte
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="space-y-6">
        {/* Infos opérateur / véhicule */}
        {(collection.operator || collection.vehicle) && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 grid grid-cols-2 gap-4">
            {collection.operator && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Opérateur</p>
                <p className="text-sm font-semibold text-gray-900">{collection.operator.name}</p>
                <p className="text-xs text-gray-400">{collection.operator.email}</p>
              </div>
            )}
            {collection.vehicle && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Véhicule</p>
                <p className="text-sm font-semibold text-gray-900">{collection.vehicle.name}</p>
                <p className="text-xs text-gray-400">{collection.vehicle.plate}{collection.vehicle.type ? ` · ${collection.vehicle.type}` : ""}</p>
              </div>
            )}
          </div>
        )}

        {/* Ordre des arrêts (drag & drop) */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Arrêts de la tournée</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {canEdit ? "Glissez pour réordonner · Ajoutez une note par arrêt" : "Lecture seule"}
              </p>
            </div>
          </div>
          <StopsManager
            collectionId={id}
            stops={stops}
            materialIcons={MATERIAL_ICONS}
            canEdit={canEdit}
          />
        </div>

        {/* Checklist pré-départ */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Checklist pré-départ</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {canEdit ? "Ajoutez des items · Cochez avant le départ" : "Checklist de vérification"}
            </p>
          </div>
          <ChecklistManager
            collectionId={id}
            initialItems={collection.checklistItems}
            canEdit={canEdit}
          />
        </div>

        {/* Actions de statut */}
        {canEdit && (
          <div className="print:hidden">
            <PrepActions
              collectionId={id}
              currentStatus={collection.status}
              checklistTotal={collection.checklistItems.length}
              checklistDone={collection.checklistItems.filter((i) => i.checked).length}
            />
          </div>
        )}

        {/* Notes globales */}
        {collection.notes && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Notes internes</p>
            <p className="text-sm text-gray-700 whitespace-pre-line">{collection.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
