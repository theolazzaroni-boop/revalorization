import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import WeekNav from "./WeekNav";

const STATUS_CONFIG = {
  SCHEDULED:   { label: "Planifiée",  color: "bg-amber-100 text-amber-700",     dot: "bg-amber-500" },
  READY:       { label: "Prête",      color: "bg-purple-100 text-purple-700",   dot: "bg-purple-500" },
  IN_PROGRESS: { label: "En cours",   color: "bg-blue-100 text-blue-700",       dot: "bg-blue-500" },
  COMPLETED:   { label: "Terminée",   color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  CANCELLED:   { label: "Annulée",    color: "bg-gray-100 text-gray-500",       dot: "bg-gray-400" },
} as const;

async function getTenantId(email: string | undefined) {
  if (!email) return null;
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) return user.tenantId;
  const tenant = await prisma.tenant.findFirst();
  return tenant?.id ?? null;
}

function getWeekBounds(weekOffset: number) {
  const now = new Date();
  const day = now.getDay(); // 0 = dim
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 6);
  friday.setHours(23, 59, 59, 999);
  return { monday, friday };
}

function getDaysOfWeek(monday: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default async function PreparationPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const weekOffset = parseInt(week ?? "0", 10);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const tenantId = await getTenantId(user?.email);

  const { monday, friday } = getWeekBounds(weekOffset);
  const days = getDaysOfWeek(monday);

  const collections = await prisma.collection.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      scheduledDate: { gte: monday, lte: friday },
      status: { not: "CANCELLED" },
    },
    include: {
      operator: { select: { name: true } },
      vehicle:  { select: { name: true, plate: true } },
      collectionItems: {
        include: {
          surplusListing: {
            include: { partner: { select: { name: true } } },
          },
        },
      },
      checklistItems: { select: { checked: true } },
    },
    orderBy: { scheduledDate: "asc" },
  });

  const weekLabel = `Semaine du ${monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} au ${friday.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;

  return (
    <div className="p-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/collections" className="hover:text-gray-700 transition-colors">Collectes</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Planification</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planification</h1>
          <p className="text-sm text-gray-500 mt-1">{weekLabel}</p>
        </div>
        <WeekNav weekOffset={weekOffset} />
      </div>

      {/* Vue semaine */}
      <div className="grid grid-cols-7 gap-3">
        {days.map((day) => {
          const isToday = day.toDateString() === new Date().toDateString();
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const dayCollections = collections.filter(
            (c) => new Date(c.scheduledDate).toDateString() === day.toDateString()
          );

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[200px] rounded-xl border p-3 ${
                isWeekend
                  ? "bg-gray-50 border-gray-100"
                  : isToday
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-white border-gray-200"
              }`}
            >
              <div className="mb-2">
                <p className={`text-xs font-medium uppercase tracking-wide ${isToday ? "text-emerald-600" : "text-gray-400"}`}>
                  {day.toLocaleDateString("fr-FR", { weekday: "short" })}
                </p>
                <p className={`text-lg font-bold leading-tight ${isToday ? "text-emerald-700" : "text-gray-700"}`}>
                  {day.getDate()}
                </p>
              </div>

              <div className="space-y-2">
                {dayCollections.map((col) => {
                  const cfg = STATUS_CONFIG[col.status as keyof typeof STATUS_CONFIG];
                  const total = col.checklistItems.length;
                  const done = col.checklistItems.filter((i) => i.checked).length;
                  const checkPct = total > 0 ? Math.round((done / total) * 100) : null;

                  return (
                    <Link
                      key={col.id}
                      href={`/collections/${col.id}/preparation`}
                      className="block rounded-lg border border-gray-100 bg-white p-2.5 hover:border-emerald-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        {checkPct !== null && (
                          <span className="text-xs text-gray-400">{checkPct}%</span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-gray-800 leading-tight">
                        {col.collectionItems.length} arrêt{col.collectionItems.length > 1 ? "s" : ""}
                      </p>
                      {col.operator && (
                        <p className="text-xs text-gray-400 mt-0.5">{col.operator.name}</p>
                      )}
                      {col.vehicle && (
                        <p className="text-xs text-gray-400">{col.vehicle.name}</p>
                      )}
                      {checkPct !== null && (
                        <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${checkPct}%` }}
                          />
                        </div>
                      )}
                    </Link>
                  );
                })}
                {dayCollections.length === 0 && !isWeekend && (
                  <p className="text-xs text-gray-300 text-center pt-4">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Légende */}
      <div className="mt-6 flex items-center gap-4 text-xs text-gray-400">
        {Object.entries(STATUS_CONFIG).map(([, cfg]) => (
          <span key={cfg.label} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        ))}
      </div>
    </div>
  );
}
