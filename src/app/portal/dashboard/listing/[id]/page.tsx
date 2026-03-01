import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; icon: string }> = {
  DRAFT:      { label: "Brouillon",  color: "bg-gray-100 text-gray-600",       dot: "bg-gray-400",    icon: "○" },
  SUBMITTED:  { label: "Envoyée",    color: "bg-blue-100 text-blue-700",        dot: "bg-blue-500",    icon: "→" },
  SCHEDULED:  { label: "Planifiée",  color: "bg-amber-100 text-amber-700",      dot: "bg-amber-500",   icon: "📅" },
  COLLECTED:  { label: "Collectée",  color: "bg-emerald-100 text-emerald-700",  dot: "bg-emerald-500", icon: "✓" },
  CANCELLED:  { label: "Annulée",    color: "bg-red-100 text-red-600",          dot: "bg-red-400",     icon: "✕" },
};

const CATEGORY_ICONS: Record<string, string> = {
  PLASTIC: "♻️", METAL: "⚙️", WOOD: "🪵", ELECTRONIC: "💻",
  PAPER: "📦", GLASS: "🔷", TEXTILE: "👕", OTHER: "🗃️",
};

const EVENT_LABELS: Record<string, { label: string; description: string; color: string }> = {
  SUBMITTED:  { label: "Demande envoyée",       description: "Votre demande a bien été reçue",                   color: "bg-blue-500" },
  SCHEDULED:  { label: "Collecte planifiée",     description: "Une date de collecte a été fixée",                 color: "bg-amber-500" },
  COLLECTED:  { label: "Collecte réalisée",      description: "Vos matières ont été collectées et valorisées",    color: "bg-emerald-500" },
  RECEIVED:   { label: "Lot réceptionné",        description: "Vos matières ont été réceptionnées en centre",     color: "bg-violet-500" },
  CANCELLED:  { label: "Annulée",               description: "Cette demande a été annulée",                      color: "bg-red-400" },
};

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/portal/login");

  const partner = await prisma.partner.findUnique({ where: { userId: user.id } });
  if (!partner) redirect("/portal/login");

  const listing = await prisma.surplusListing.findFirst({
    where: { id, partnerId: partner.id },
    include: {
      material: { select: { name: true, category: true, unit: true, co2FactorPerUnit: true } },
      collectionItems: {
        include: {
          collection: {
            select: { scheduledDate: true, status: true, operator: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!listing) notFound();

  const traceEvents = await prisma.traceEvent.findMany({
    where: { entityType: "SURPLUS_LISTING", entityId: id },
    orderBy: { createdAt: "asc" },
  });

  const cfg = STATUS_CONFIG[listing.status] ?? STATUS_CONFIG.DRAFT;
  const icon = CATEGORY_ICONS[listing.material.category] ?? "🗃️";
  const co2 = listing.status === "COLLECTED"
    ? Math.round(listing.quantityEstimated * listing.material.co2FactorPerUnit * 1000)
    : null;

  const scheduledCollection = listing.collectionItems[0]?.collection;

  // Build timeline: events from DB + future steps
  const LIFECYCLE = ["SUBMITTED", "SCHEDULED", "COLLECTED"];
  const currentIndex = LIFECYCLE.indexOf(listing.status === "CANCELLED" ? "SUBMITTED" : listing.status);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/portal/dashboard" className="hover:text-gray-700 transition-colors">
          Mes demandes
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{listing.material.name}</span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-4 mb-4">
          <span className="text-4xl">{icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{listing.material.name}</h1>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Demande créée le {new Date(listing.createdAt).toLocaleDateString("fr-FR", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-50 rounded-xl p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide mb-1">Quantité</dt>
            <dd className="font-semibold text-gray-900">
              {listing.quantityEstimated} {listing.material.unit === "TONNE" ? "t" : listing.material.unit.toLowerCase()}
            </dd>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide mb-1">État</dt>
            <dd className="font-semibold text-gray-900">{listing.condition}</dd>
          </div>
          {listing.locationAddress && (
            <div className="bg-gray-50 rounded-xl p-3 col-span-2">
              <dt className="text-xs text-gray-400 uppercase tracking-wide mb-1">Adresse</dt>
              <dd className="font-medium text-gray-900">{listing.locationAddress}</dd>
            </div>
          )}
          {listing.preferredDate && (
            <div className="bg-gray-50 rounded-xl p-3">
              <dt className="text-xs text-gray-400 uppercase tracking-wide mb-1">Date souhaitée</dt>
              <dd className="font-medium text-gray-900">
                {new Date(listing.preferredDate).toLocaleDateString("fr-FR")}
              </dd>
            </div>
          )}
          {scheduledCollection && (
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
              <dt className="text-xs text-amber-600 uppercase tracking-wide mb-1">Collecte prévue</dt>
              <dd className="font-semibold text-amber-900">
                {new Date(scheduledCollection.scheduledDate).toLocaleDateString("fr-FR", {
                  weekday: "short", day: "numeric", month: "long",
                })}
                {scheduledCollection.operator && (
                  <span className="text-xs text-amber-700 font-normal block mt-0.5">
                    par {scheduledCollection.operator.name}
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>

        {listing.description && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-gray-700">{listing.description}</p>
          </div>
        )}
      </div>

      {/* Impact block — only when collected */}
      {co2 && (
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 mb-6 text-white">
          <p className="text-sm font-medium text-emerald-100 mb-3">🌱 Impact de cette collecte</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold">{listing.quantityEstimated} t</p>
              <p className="text-xs text-emerald-100 mt-0.5">valorisées</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{co2.toLocaleString("fr-FR")} kg</p>
              <p className="text-xs text-emerald-100 mt-0.5">de CO₂ évités</p>
            </div>
          </div>
        </div>
      )}

      {/* Traceability timeline */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-5">
          Suivi de ma demande
        </h2>

        {listing.status === "CANCELLED" ? (
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
            <span className="text-2xl">✕</span>
            <div>
              <p className="text-sm font-semibold text-red-700">Demande annulée</p>
              <p className="text-xs text-red-500 mt-0.5">Cette demande a été annulée.</p>
            </div>
          </div>
        ) : (
          <ol className="relative">
            {LIFECYCLE.map((step, i) => {
              const done = i <= currentIndex;
              const active = i === currentIndex;
              const eventForStep = traceEvents.find((e) => e.eventType === step);
              const stepCfg = EVENT_LABELS[step];

              return (
                <li key={step} className="relative pl-10 pb-6 last:pb-0">
                  {/* Connector line */}
                  {i < LIFECYCLE.length - 1 && (
                    <div
                      className={`absolute left-3.5 top-4 w-0.5 h-full -translate-x-1/2 ${
                        i < currentIndex ? "bg-emerald-300" : "bg-gray-200"
                      }`}
                    />
                  )}
                  {/* Circle */}
                  <div
                    className={`absolute left-0 top-0.5 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                      done
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "bg-white border-gray-200 text-gray-400"
                    } ${active ? "ring-4 ring-emerald-100" : ""}`}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  {/* Content */}
                  <div className={done ? "" : "opacity-40"}>
                    <p className={`text-sm font-semibold ${done ? "text-gray-900" : "text-gray-500"}`}>
                      {stepCfg?.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{stepCfg?.description}</p>
                    {eventForStep && (
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(eventForStep.createdAt).toLocaleString("fr-FR", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Back link */}
      <div className="mt-6 text-center">
        <Link href="/portal/dashboard" className="text-sm text-gray-500 hover:text-gray-700 transition">
          ← Retour à mes demandes
        </Link>
      </div>
    </div>
  );
}
