import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { token } = await req.json();

  const partner = await prisma.partner.findUnique({
    where: { portalToken: token },
  });

  if (!partner) {
    return NextResponse.json({ error: "Token invalide" }, { status: 404 });
  }

  if (partner.userId && partner.userId !== user.id) {
    return NextResponse.json({ error: "Ce partenaire est déjà associé à un compte" }, { status: 409 });
  }

  await prisma.partner.update({
    where: { id: partner.id },
    data: { userId: user.id, email: user.email },
  });

  return NextResponse.json({ ok: true });
}
