import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const partner = await prisma.partner.findUnique({
    where: { portalToken: token },
    select: { id: true, name: true, userId: true },
  });

  if (!partner) {
    return NextResponse.json({ error: "Token invalide" }, { status: 404 });
  }

  return NextResponse.json({
    partnerName: partner.name,
    hasAccount: !!partner.userId,
  });
}
