"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Status = "SUBMITTED" | "SCHEDULED" | "COLLECTED" | "CANCELLED";

const ACTIONS: Record<Status, { label: string; next: Status; style: string }[]> = {
  SUBMITTED: [
    { label: "✓ Accepter & planifier", next: "SCHEDULED", style: "bg-emerald-600 hover:bg-emerald-700 text-white" },
    { label: "✕ Refuser",             next: "CANCELLED", style: "border border-red-300 text-red-600 hover:bg-red-50" },
  ],
  SCHEDULED: [
    { label: "✓ Marquer comme collectée", next: "COLLECTED", style: "bg-emerald-600 hover:bg-emerald-700 text-white" },
    { label: "✕ Annuler",                 next: "CANCELLED", style: "border border-gray-300 text-gray-600 hover:bg-gray-50" },
  ],
  COLLECTED: [],
  CANCELLED: [],
};

export default function ListingActions({ listingId, status }: { listingId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<Status | null>(null);

  const actions = ACTIONS[status as Status] ?? [];
  if (actions.length === 0) return null;

  async function handleAction(next: Status) {
    setLoading(next);
    await fetch(`/api/listings/${listingId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    router.refresh();
    setLoading(null);
  }

  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <button
          key={action.next}
          onClick={() => handleAction(action.next)}
          disabled={loading !== null}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 ${action.style}`}
        >
          {loading === action.next ? "En cours..." : action.label}
        </button>
      ))}
    </div>
  );
}
