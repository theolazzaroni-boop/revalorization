import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function getTenantAndUserId(email: string | undefined) {
  if (!email) return { tenantId: null, userId: null };
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) return { tenantId: user.tenantId, userId: user.id };
  const tenant = await prisma.tenant.findFirst();
  return { tenantId: tenant?.id ?? null, userId: null };
}

export async function POST(req: NextRequest) {
  const { scheduledDate, operatorId, vehicleId, notes, listingIds } = await req.json();

  if (!scheduledDate || !listingIds?.length) {
    return NextResponse.json({ error: "Date et au moins une annonce requis" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { tenantId, userId } = await getTenantAndUserId(authUser?.email);

  if (!tenantId) {
    return NextResponse.json({ error: "Tenant introuvable" }, { status: 400 });
  }

  // Vérifier que toutes les annonces appartiennent au tenant et sont SCHEDULED
  const listings = await prisma.surplusListing.findMany({
    where: { id: { in: listingIds }, tenantId, status: "SCHEDULED" },
    select: { id: true },
  });

  if (listings.length !== listingIds.length) {
    return NextResponse.json(
      { error: "Certaines annonces sont invalides ou pas encore planifiées" },
      { status: 422 }
    );
  }

  const collection = await prisma.collection.create({
    data: {
      tenantId,
      scheduledDate: new Date(scheduledDate),
      ...(operatorId ? { operatorId } : {}),
      ...(vehicleId ? { vehicleId } : {}),
      notes: notes || null,
      status: "SCHEDULED",
      collectionItems: {
        create: listingIds.map((id: string) => ({ surplusListingId: id })),
      },
    },
  });

  // TraceEvent pour chaque annonce
  if (listingIds.length > 0) {
    await prisma.traceEvent.createMany({
      data: listingIds.map((listingId: string) => ({
        tenantId,
        entityType: "COLLECTION" as const,
        entityId: collection.id,
        eventType: "SCHEDULED" as const,
        ...(userId ? { userId } : {}),
      })),
    });
  }

  return NextResponse.json({ id: collection.id });
}
