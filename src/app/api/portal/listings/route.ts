import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { MaterialCategory, MaterialUnit, TraceEntityType, TraceEventType } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

const CONDITION_MAP: Record<string, string> = {
  clean: "Propre",
  light: "Légèrement souillé",
  dirty: "Souillé",
};

const CO2_FACTORS: Record<string, number> = {
  PLASTIC: 1200, METAL: 1800, WOOD: 400,
  ELECTRONIC: 2500, PAPER: 700, GLASS: 300,
  TEXTILE: 5000, OTHER: 500,
};

const CATEGORY_LABELS: Record<string, string> = {
  PLASTIC: "Plastique", METAL: "Métal", WOOD: "Bois",
  ELECTRONIC: "Électronique (DEEE)", PAPER: "Papier / Carton",
  GLASS: "Verre", TEXTILE: "Textile", OTHER: "Autre",
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const partner = await prisma.partner.findUnique({
    where: { userId: user.id },
  });

  if (!partner) {
    return NextResponse.json({ error: "Partenaire introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const { category, condition, quantity, unit, description, locationAddress, preferredDate } = body;

  if (!category || !condition || !quantity || !locationAddress) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  let material = await prisma.material.findFirst({
    where: { tenantId: partner.tenantId, category: category as MaterialCategory },
  });

  if (!material) {
    material = await prisma.material.create({
      data: {
        tenantId: partner.tenantId,
        name: CATEGORY_LABELS[category] ?? category,
        category: category as MaterialCategory,
        unit: (unit as MaterialUnit) ?? "TONNE",
        co2FactorPerUnit: (CO2_FACTORS[category] ?? 500) / 1000,
      },
    });
  }

  const listing = await prisma.surplusListing.create({
    data: {
      tenantId: partner.tenantId,
      partnerId: partner.id,
      materialId: material.id,
      quantityEstimated: parseFloat(quantity),
      condition: CONDITION_MAP[condition] ?? condition,
      description: description || null,
      locationAddress,
      preferredDate: preferredDate ? new Date(preferredDate) : null,
      status: "SUBMITTED",
    },
  });

  await prisma.traceEvent.create({
    data: {
      tenantId: partner.tenantId,
      entityType: TraceEntityType.SURPLUS_LISTING,
      entityId: listing.id,
      eventType: TraceEventType.SUBMITTED,
      partnerId: partner.id,
    },
  });

  return NextResponse.json({ id: listing.id }, { status: 201 });
}
