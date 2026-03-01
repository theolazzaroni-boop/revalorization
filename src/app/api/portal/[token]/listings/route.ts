import { prisma } from "@/lib/prisma";
import { MaterialCategory, MaterialUnit, TraceEntityType, TraceEventType } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

const CONDITION_MAP: Record<string, string> = {
  clean: "Propre",
  light: "Légèrement souillé",
  dirty: "Souillé",
};

// Facteurs CO2 par défaut (kg CO2 évité par tonne valorisée)
const CO2_FACTORS: Record<string, number> = {
  PLASTIC: 1200,
  METAL: 1800,
  WOOD: 400,
  ELECTRONIC: 2500,
  PAPER: 700,
  GLASS: 300,
  TEXTILE: 5000,
  OTHER: 500,
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // 1. Vérifier le token
  const partner = await prisma.partner.findUnique({
    where: { portalToken: token },
  });

  if (!partner) {
    return NextResponse.json({ error: "Token invalide" }, { status: 404 });
  }

  const body = await req.json();
  const { category, condition, quantity, unit, description, locationAddress, preferredDate } = body;

  if (!category || !condition || !quantity || !locationAddress) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  // 2. Trouver ou créer le matériau correspondant pour ce tenant
  let material = await prisma.material.findFirst({
    where: { tenantId: partner.tenantId, category: category as MaterialCategory },
  });

  if (!material) {
    const categoryLabels: Record<string, string> = {
      PLASTIC: "Plastique", METAL: "Métal", WOOD: "Bois",
      ELECTRONIC: "Électronique (DEEE)", PAPER: "Papier / Carton",
      GLASS: "Verre", TEXTILE: "Textile", OTHER: "Autre",
    };
    material = await prisma.material.create({
      data: {
        tenantId: partner.tenantId,
        name: categoryLabels[category] ?? category,
        category: category as MaterialCategory,
        unit: (unit as MaterialUnit) ?? "TONNE",
        co2FactorPerUnit: (CO2_FACTORS[category] ?? 500) / 1000, // par kg
      },
    });
  }

  // 3. Créer l'annonce
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

  // 4. Enregistrer l'événement de traçabilité
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
