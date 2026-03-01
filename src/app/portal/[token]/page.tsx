import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PortalTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Si déjà connecté en tant que fournisseur → dashboard
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.user_metadata?.role === "supplier") {
    redirect("/portal/dashboard");
  }

  const partner = await prisma.partner.findUnique({
    where: { portalToken: token },
    select: { userId: true },
  });

  if (!partner) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-700 font-medium">Lien invalide.</p>
        <p className="text-sm text-gray-500 mt-2">Ce lien d&apos;invitation n&apos;existe pas ou a expiré.</p>
      </div>
    );
  }

  // Partenaire déjà inscrit → login
  if (partner.userId) redirect("/portal/login");

  // Première visite → inscription
  redirect(`/portal/register/${token}`);
}
