import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/collections/[id]/checklist/[itemId]
// Body: { label?, checked?, order? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { itemId } = await params;
  const body = await req.json();

  const item = await prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.checked !== undefined ? { checked: body.checked } : {}),
      ...(body.order !== undefined ? { order: body.order } : {}),
    },
  });

  return NextResponse.json(item);
}

// DELETE /api/collections/[id]/checklist/[itemId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { itemId } = await params;
  await prisma.checklistItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
