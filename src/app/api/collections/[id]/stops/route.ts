import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/collections/[id]/stops
// Body: { stops: [{ id, order, scheduledTime?, note? }] }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { stops } = await req.json();

  if (!Array.isArray(stops)) {
    return NextResponse.json({ error: "stops requis" }, { status: 400 });
  }

  await Promise.all(
    stops.map((stop: { id: string; order: number; scheduledTime?: string; note?: string }) =>
      prisma.collectionItem.update({
        where: { id: stop.id },
        data: {
          order: stop.order,
          ...(stop.scheduledTime !== undefined ? { scheduledTime: stop.scheduledTime } : {}),
          ...(stop.note !== undefined ? { note: stop.note } : {}),
        },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
