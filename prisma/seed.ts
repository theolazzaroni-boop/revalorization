import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding...");

  // Tenant de test
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

  console.log(`✓ Tenant: ${tenant.name}`);

  // Partenaire fournisseur de test
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

  console.log(`✓ Partenaire: ${partner.name}`);
  console.log(`\n🔗 URL portail fournisseur:`);
  console.log(`   http://localhost:3000/portal/test-token-fournisseur-123\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
