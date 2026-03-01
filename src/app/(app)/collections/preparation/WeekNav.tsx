"use client";

import { useRouter } from "next/navigation";

export default function WeekNav({ weekOffset }: { weekOffset: number }) {
  const router = useRouter();

  const go = (delta: number) => {
    const next = weekOffset + delta;
    router.push(`/collections/preparation?week=${next}`);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => go(-1)}
        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
      >
        ← Précédente
      </button>
      {weekOffset !== 0 && (
        <button
          onClick={() => go(-weekOffset)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          Aujourd&apos;hui
        </button>
      )}
      <button
        onClick={() => go(1)}
        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
      >
        Suivante →
      </button>
    </div>
  );
}
