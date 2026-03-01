import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import CollectionForm from "./CollectionForm";

async function getTenantId(email: string | undefined) {
  if (!email) return null;
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) return user.tenantId;
  const tenant = await prisma.tenant.findFirst();
  return tenant?.id ?? null;
}

export default async function NewCollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ listingId?: string }>;
}) {
  const { listingId } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const tenantId = await getTenantId(user?.email);

  if (!tenantId) {
    return <div className="p-8 text-center text-gray-500">Aucun tenant configuré.</div>;
  }

  const [listings, operators, vehicles] = await Promise.all([
    prisma.surplusListing.findMany({
      where: { tenantId, status: "SCHEDULED" },
      include: {
        material: { select: { name: true, category: true } },
        partner: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.vehicle.findMany({
      where: { tenantId },
      select: { id: true, name: true, plate: true, type: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/collections" className="hover:text-gray-700 transition-colors">Collectes</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Nouvelle collecte</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nouvelle collecte</h1>
        <p className="text-sm text-gray-500 mt-1">
          Groupez une ou plusieurs annonces planifiées dans une tournée.
        </p>
      </div>

      <CollectionForm
        listings={listings.map((l) => ({
          id: l.id,
          material: l.material,
          partner: l.partner,
          quantityEstimated: l.quantityEstimated,
          locationAddress: l.locationAddress,
        }))}
        operators={operators}
        vehicles={vehicles}
        preselectedId={listingId}
      />
    </div>
  );
}
