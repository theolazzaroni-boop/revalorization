import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Endpoint de seed uniquement en développement
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Non disponible en production" }, { status: 403 });
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: "demain-environnement" },
    update: {},
    create: {
      name: "Demain Environnement",
      slug: "demain-environnement",
      address: "Zone industrielle, 25000 Besançon",
      plan: "PRO",
    },
  });

  const partner = await prisma.partner.upsert({
    where: { portalToken: "test-token-fournisseur-123" },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Entreprise Test SAS",
      siret: "12345678901234",
      address: "1 rue de l'Industrie, 25000 Besançon",
      type: "SUPPLIER",
      contactEmail: "contact@entreprise-test.fr",
      contactPhone: "03 81 00 00 00",
      portalToken: "test-token-fournisseur-123",
    },
  });

  // Créer un User staff pour l'utilisateur actuellement connecté (s'il existe)
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  let staffUser = null;
  if (authUser && authUser.user_metadata?.role !== "supplier") {
    staffUser = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: authUser.email! } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: authUser.email!,
        name: authUser.email!.split("@")[0],
        role: "ADMIN",
      },
    });
  }

  // Véhicules de test
  const vehicleData = [
    { id: "seed-vehicle-AB123CD", name: "Camion Berliet", plate: "AB-123-CD", type: "Poids lourd" },
    { id: "seed-vehicle-EF456GH", name: "Fourgon Renault", plate: "EF-456-GH", type: "Fourgon" },
    { id: "seed-vehicle-IJ789KL", name: "Benne Volvo",    plate: "IJ-789-KL", type: "Benne" },
  ];
  const vehicles = await Promise.all(
    vehicleData.map((v) =>
      prisma.vehicle.upsert({
        where: { id: v.id },
        update: {},
        create: { tenantId: tenant.id, ...v },
      })
    )
  );

  return NextResponse.json({
    tenant: { id: tenant.id, name: tenant.name },
    partner: { id: partner.id, name: partner.name },
    staffUser: staffUser ? { id: staffUser.id, email: staffUser.email } : null,
    vehicles: vehicles.map((v) => ({ id: v.id, name: v.name, plate: v.plate })),
    portalUrl: "http://localhost:3000/portal/test-token-fournisseur-123",
  });
}
