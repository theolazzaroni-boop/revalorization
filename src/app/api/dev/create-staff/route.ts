import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Endpoint de dev uniquement — crée un compte staff Supabase + User en base
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Non disponible en production" }, { status: 403 });
  }

  const email = "admin@revalorization.dev";
  const password = "Admin1234!";

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Cherche si l'utilisateur existe déjà
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const existing = existingUsers?.users.find((u) => u.email === email);

  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      // Pas de user_metadata.role → compte staff
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    userId = data.user.id;
  }

  // Tenant de dev
  const tenant = await prisma.tenant.findFirst({ where: { slug: "demain-environnement" } });
  if (!tenant) {
    return NextResponse.json({ error: "Lance d'abord /api/dev/seed" }, { status: 400 });
  }

  const staffUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: {},
    create: {
      tenantId: tenant.id,
      email,
      name: "Admin",
      role: "ADMIN",
    },
  });

  return NextResponse.json({
    ok: true,
    email,
    password,
    staffUser: { id: staffUser.id, email: staffUser.email },
  });
}
