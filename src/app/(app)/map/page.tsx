import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { MapPin } from "./CollectionMap";
import MapWrapper from "./MapWrapper";

async function getTenantId(email: string | undefined) {
  if (!email) return null;
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) return user.tenantId;
  const tenant = await prisma.tenant.findFirst();
  return tenant?.id ?? null;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1&countrycodes=fr`,
      {
        headers: {
          "User-Agent": "Revalorization-App/1.0 contact@revalorization.fr",
          "Accept-Language": "fr",
        },
        next: { revalidate: 86400 }, // cache for 24h
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

async function geocodeAll(addresses: string[]): Promise<Map<string, { lat: number; lng: number }>> {
  const unique = [...new Set(addresses)];
  const results = new Map<string, { lat: number; lng: number }>();

  for (const addr of unique) {
    const coords = await geocodeAddress(addr);
    if (coords) results.set(addr, coords);
    // Nominatim rate limit: 1 req/s — small delay between requests
    await new Promise((r) => setTimeout(r, 250));
  }

  return results;
}

export default async function MapPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const tenantId = await getTenantId(user?.email);

  const listings = await prisma.surplusListing.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      status: { in: ["SUBMITTED", "SCHEDULED", "COLLECTED"] },
      locationAddress: { not: null },
    },
    include: {
      partner: { select: { name: true } },
      material: { select: { name: true, category: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Geocode all unique addresses
  const addresses = listings
    .map((l) => l.locationAddress)
    .filter(Boolean) as string[];
  const coordsMap = await geocodeAll(addresses);

  // Build map pins
  const pins: MapPin[] = listings
    .map((l) => {
      const coords = l.locationAddress ? coordsMap.get(l.locationAddress) : null;
      if (!coords) return null;
      return {
        lat: coords.lat,
        lng: coords.lng,
        label: l.id,
        partner: l.partner.name,
        material: l.material.name,
        quantity: l.quantityEstimated,
        status: l.status,
        address: l.locationAddress ?? "",
      };
    })
    .filter(Boolean) as MapPin[];

  // Stats
  const statuses = ["SUBMITTED", "SCHEDULED", "COLLECTED"] as const;
  const counts = statuses.reduce((acc, s) => {
    acc[s] = listings.filter((l) => l.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    SUBMITTED: { label: "Nouvelles",  color: "text-blue-600",    bg: "bg-blue-50",    dot: "bg-blue-500"    },
    SCHEDULED: { label: "Planifiées", color: "text-amber-600",   bg: "bg-amber-50",   dot: "bg-amber-500"   },
    COLLECTED: { label: "Collectées", color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carte des flux</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pins.length} point{pins.length > 1 ? "s" : ""} localisé{pins.length > 1 ? "s" : ""} sur{" "}
            {listings.length} annonce{listings.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Stats / legend */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {statuses.map((s) => {
          const meta = STATUS_META[s];
          return (
            <div key={s} className={`${meta.bg} rounded-xl p-4 flex items-center gap-3`}>
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${meta.dot}`} />
              <div>
                <p className={`text-xl font-bold ${meta.color}`}>{counts[s] ?? 0}</p>
                <p className="text-xs text-gray-500">{meta.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Map container */}
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: "540px" }}>
        {pins.length === 0 ? (
          <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center gap-3">
            <span className="text-5xl">🗺️</span>
            <p className="text-gray-500 text-sm">Aucune adresse localisable pour le moment.</p>
            <p className="text-gray-400 text-xs">Les annonces avec une adresse complète apparaîtront ici.</p>
          </div>
        ) : (
          <MapWrapper pins={pins} />
        )}
      </div>

      {/* Flow detail list */}
      {listings.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Détail des flux</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {listings.slice(0, 20).map((l) => {
              const hasCoords = l.locationAddress ? coordsMap.has(l.locationAddress) : false;
              const dot = l.status === "SUBMITTED"
                ? "bg-blue-500"
                : l.status === "SCHEDULED"
                ? "bg-amber-500"
                : "bg-emerald-500";
              return (
                <div key={l.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{l.partner.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {l.material.name} · {l.quantityEstimated} t
                      {l.locationAddress && ` · ${l.locationAddress}`}
                    </p>
                  </div>
                  {!hasCoords && l.locationAddress && (
                    <span className="text-xs text-gray-400 italic shrink-0">non localisé</span>
                  )}
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(l.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
