import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const VALID_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["COLLECTED", "CANCELLED"],
};

const EVENT_TYPE_MAP: Record<string, string> = {
  SCHEDULED: "SCHEDULED",
  COLLECTED: "COLLECTED",
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

  const listing = await prisma.surplusListing.findFirst({
    where: { id, ...(tenantId ? { tenantId } : {}) },
    select: { id: true, status: true, tenantId: true },
  });

  if (!listing) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const allowed = VALID_TRANSITIONS[listing.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Transition ${listing.status} → ${newStatus} non autorisée` },
      { status: 422 }
    );
  }

  await prisma.surplusListing.update({
    where: { id },
    data: { status: newStatus as never },
  });

  const eventType = EVENT_TYPE_MAP[newStatus];
  if (eventType) {
    await prisma.traceEvent.create({
      data: {
        tenantId: listing.tenantId,
        entityType: "SURPLUS_LISTING",
        entityId: id,
        eventType: eventType as never,
        ...(userId ? { userId } : {}),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
