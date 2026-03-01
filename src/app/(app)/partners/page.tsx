import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const TYPE_CONFIG = {
  SUPPLIER: { label: "Cédant",         color: "bg-blue-100 text-blue-700"   },
  BUYER:    { label: "Acheteur",        color: "bg-violet-100 text-violet-700" },
  BOTH:     { label: "Cédant & Acheteur", color: "bg-emerald-100 text-emerald-700" },
} as const;

const PORTAL_STATUS = {
  registered: { label: "Portail actif",     color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  invited:    { label: "Invité",             color: "bg-amber-100 text-amber-700",     dot: "bg-amber-500"   },
  none:       { label: "Sans portail",       color: "bg-gray-100 text-gray-500",       dot: "bg-gray-400"    },
};

async function getTenantId(email: string | undefined) {
  if (!email) return null;
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) return user.tenantId;
  const tenant = await prisma.tenant.findFirst();
  return tenant?.id ?? null;
}

export default async function PartnersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const tenantId = await getTenantId(user?.email);

  const partners = await prisma.partner.findMany({
    where: tenantId ? { tenantId } : {},
    include: {
      surplusListings: {
        select: {
          id: true,
          status: true,
          quantityEstimated: true,
          material: { select: { co2FactorPerUnit: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const suppliers = partners.filter((p) => p.type === "SUPPLIER" || p.type === "BOTH");
  const buyers    = partners.filter((p) => p.type === "BUYER");

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partenaires</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {suppliers.length} cédant{suppliers.length > 1 ? "s" : ""} · {buyers.length} acheteur{buyers.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Cédants */}
      {suppliers.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Cédants de matières
          </h2>
          <div className="space-y-3">
            {suppliers.map((partner) => {
              const collected = partner.surplusListings.filter((l) => l.status === "COLLECTED");
              const tonnes    = collected.reduce((s, l) => s + l.quantityEstimated, 0);
              const co2       = collected.reduce((s, l) => s + l.quantityEstimated * l.material.co2FactorPerUnit * 1000, 0);
              const active    = partner.surplusListings.filter((l) => ["SUBMITTED", "SCHEDULED"].includes(l.status)).length;
              const typeCfg   = TYPE_CONFIG[partner.type as keyof typeof TYPE_CONFIG];

              const portalState = partner.userId
                ? PORTAL_STATUS.registered
                : partner.portalToken
                ? PORTAL_STATUS.invited
                : PORTAL_STATUS.none;

              return (
                <Link
                  key={partner.id}
                  href={`/partners/${partner.id}`}
                  className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-emerald-300 hover:shadow-sm transition group"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg font-bold text-emerald-600 shrink-0">
                      {partner.name.charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">
                          {partner.name}
                        </p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeCfg.color}`}>
                          {typeCfg.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${portalState.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${portalState.dot}`} />
                          {portalState.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {partner.contactEmail ?? partner.email ?? "—"}
                        {partner.address && ` · ${partner.address}`}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 shrink-0 text-right">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{partner.surplusListings.length}</p>
                        <p className="text-xs text-gray-400">demande{partner.surplusListings.length > 1 ? "s" : ""}</p>
                      </div>
                      {active > 0 && (
                        <div>
                          <p className="text-sm font-bold text-amber-600">{active}</p>
                          <p className="text-xs text-gray-400">en cours</p>
                        </div>
                      )}
                      {tonnes > 0 && (
                        <div>
                          <p className="text-sm font-bold text-emerald-600">{tonnes.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t</p>
                          <p className="text-xs text-gray-400">{Math.round(co2).toLocaleString("fr-FR")} kg CO₂</p>
                        </div>
                      )}
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Acheteurs */}
      {buyers.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Acheteurs
          </h2>
          <div className="space-y-3">
            {buyers.map((partner) => {
              const typeCfg = TYPE_CONFIG[partner.type as keyof typeof TYPE_CONFIG];
              return (
                <Link
                  key={partner.id}
                  href={`/partners/${partner.id}`}
                  className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-violet-300 hover:shadow-sm transition group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-lg font-bold text-violet-600 shrink-0">
                      {partner.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-violet-700 transition-colors">
                          {partner.name}
                        </p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeCfg.color}`}>
                          {typeCfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {partner.contactEmail ?? "—"}
                        {partner.address && ` · ${partner.address}`}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-violet-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {partners.length === 0 && (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-400">Aucun partenaire configuré.</p>
        </div>
      )}
    </div>
  );
}
