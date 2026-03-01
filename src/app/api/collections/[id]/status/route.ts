import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const VALID_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED:   ["READY", "IN_PROGRESS", "CANCELLED"],
  READY:       ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
};

async function getTenantAndUserId(email: string | undefined) {
  if (!email) return { tenantId: null, userId: null };
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) return { tenantId: user.tenantId, userId: user.id };
  const tenant = await prisma.tenant.findFirst();
  return { tenantId: tenant?.id ?? null, userId: null };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status: newStatus } = await req.json();

  if (!newStatus) {
    return NextResponse.json({ error: "Statut manquant" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { tenantId, userId } = await getTenantAndUserId(authUser?.email);

  const collection = await prisma.collection.findFirst({
    where: { id, ...(tenantId ? { tenantId } : {}) },
    include: {
      collectionItems: { select: { surplusListingId: true } },
    },
  });

  if (!collection) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const allowed = VALID_TRANSITIONS[collection.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Transition ${collection.status} → ${newStatus} non autorisée` },
      { status: 422 }
    );
  }

  await prisma.collection.update({
    where: { id },
    data: {
      status: newStatus as never,
      ...(newStatus === "COMPLETED" ? { actualDate: new Date() } : {}),
    },
  });

  // Si COMPLETED → marquer toutes les annonces liées comme COLLECTED
  if (newStatus === "COMPLETED") {
    const listingIds = collection.collectionItems.map((item) => item.surplusListingId);
    if (listingIds.length > 0) {
      await prisma.surplusListing.updateMany({
        where: { id: { in: listingIds } },
        data: { status: "COLLECTED" },
      });
      await prisma.traceEvent.createMany({
        data: listingIds.map((listingId) => ({
          tenantId: collection.tenantId,
          entityType: "SURPLUS_LISTING" as const,
          entityId: listingId,
          eventType: "COLLECTED" as const,
          ...(userId ? { userId } : {}),
        })),
      });
    }
  }

  await prisma.traceEvent.create({
    data: {
      tenantId: collection.tenantId,
      entityType: "COLLECTION",
      entityId: id,
      eventType: newStatus === "COMPLETED" ? "COLLECTED" : newStatus === "READY" ? "READY" : "SCHEDULED",
      ...(userId ? { userId } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
