import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import NewListingForm from "./NewListingForm";

export default async function PortalNewListingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/portal/login");

  const partner = await prisma.partner.findUnique({
    where: { userId: user.id },
    select: { name: true },
  });

  if (!partner) redirect("/portal/login");

  return <NewListingForm partnerName={partner.name} />;
}
