import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import NewListingForm from "./NewListingForm";

export default async function NewListingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const partner = await prisma.partner.findUnique({
    where: { portalToken: token },
    include: { tenant: true },
  });

  if (!partner) notFound();

  return <NewListingForm token={token} partnerName={partner.name} />;
}
