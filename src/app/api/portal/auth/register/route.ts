import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { token, email, password } = await req.json();

  if (!token || !email || !password) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  const partner = await prisma.partner.findUnique({
    where: { portalToken: token },
  });

  if (!partner) {
    return NextResponse.json({ error: "Token invalide" }, { status: 404 });
  }

  if (partner.userId) {
    return NextResponse.json({ error: "Un compte existe déjà pour ce partenaire" }, { status: 409 });
  }

  // Admin client — bypass email confirmation
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    user_metadata: { role: "supplier" },
    email_confirm: true,
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  await prisma.partner.update({
    where: { id: partner.id },
    data: { userId: data.user.id, email },
  });

  return NextResponse.json({ ok: true });
}
