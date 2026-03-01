import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import CollectionsClient from "./CollectionsClient";

async function getTenantId(email: string | undefined) {
  if (!email) return null;
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) return user.tenantId;
  const tenant = await prisma.tenant.findFirst();
  return tenant?.id ?? null;
}

export default async function CollectionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const tenantId = await getTenantId(user?.email);

  if (!tenantId) {
    return (
      <div className="p-8 text-center text-gray-500">Aucun tenant configuré.</div>
    );
  }

  const [collections, operators, vehicles, partners] = await Promise.all([
    prisma.collection.findMany({
      where: { tenantId },
      include: {
        operator: { select: { id: true, name: true } },
        vehicle:  { select: { id: true, name: true, plate: true } },
        collectionItems: {
          include: {
            surplusListing: {
              include: {
                partner:  { select: { id: true, name: true } },
                material: { select: { id: true, name: true, co2FactorPerUnit: true } },
              },
            },
          },
        },
      },
      orderBy: { scheduledDate: "asc" },
    }),
    prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.vehicle.findMany({
      where: { tenantId },
      select: { id: true, name: true, plate: true },
      orderBy: { name: "asc" },
    }),
    prisma.partner.findMany({
      where: { tenantId, type: { in: ["SUPPLIER", "BOTH"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Serialize dates for client component
  const serialized = collections.map((col) => ({
    ...col,
    scheduledDate: col.scheduledDate.toISOString(),
    actualDate: col.actualDate?.toISOString() ?? null,
  }));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collectes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{collections.length} au total</p>
        </div>
        <Link
          href="/collections/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle collecte
        </Link>
      </div>

      <CollectionsClient
        collections={serialized}
        operators={operators}
        vehicles={vehicles}
        partners={partners}
      />
    </div>
  );
}
