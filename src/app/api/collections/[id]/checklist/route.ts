import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/collections/[id]/checklist
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const items = await prisma.checklistItem.findMany({
    where: { collectionId: id },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(items);
}

// POST /api/collections/[id]/checklist
// Body: { label }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { label } = await req.json();

  if (!label?.trim()) {
    return NextResponse.json({ error: "label requis" }, { status: 400 });
  }

  const count = await prisma.checklistItem.count({ where: { collectionId: id } });

  const item = await prisma.checklistItem.create({
    data: { collectionId: id, label: label.trim(), order: count },
  });

  return NextResponse.json(item, { status: 201 });
}
