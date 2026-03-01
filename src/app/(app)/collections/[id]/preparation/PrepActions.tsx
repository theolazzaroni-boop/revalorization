"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PrepActions({
  collectionId,
  currentStatus,
  checklistTotal,
  checklistDone,
}: {
  collectionId: string;
  currentStatus: string;
  checklistTotal: number;
  checklistDone: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const changeStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      await fetch(`/api/collections/${collectionId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const allChecked = checklistTotal > 0 && checklistDone === checklistTotal;
  const checklistLabel =
    checklistTotal === 0
      ? "Aucun item de checklist"
      : allChecked
      ? `Checklist complète (${checklistDone}/${checklistTotal})`
      : `Checklist : ${checklistDone}/${checklistTotal} validés`;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Statut de préparation</h2>

      {/* Résumé checklist */}
      <div className={`flex items-center gap-2 text-sm mb-5 ${allChecked ? "text-emerald-600" : "text-amber-600"}`}>
        <span className={`w-2 h-2 rounded-full ${allChecked ? "bg-emerald-500" : "bg-amber-400"}`} />
        {checklistLabel}
      </div>

      <div className="flex gap-3">
        {currentStatus === "SCHEDULED" && (
          <button
            onClick={() => changeStatus("READY")}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-40 transition"
          >
            {loading ? "..." : "✓ Marquer comme prête"}
          </button>
        )}

        {currentStatus === "READY" && (
          <>
            <button
              onClick={() => changeStatus("SCHEDULED")}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 transition"
            >
              ← Retour planifiée
            </button>
            <button
              onClick={() => changeStatus("IN_PROGRESS")}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition"
            >
              {loading ? "..." : "▶ Démarrer la collecte"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
