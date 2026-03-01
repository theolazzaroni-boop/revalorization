"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Listing = {
  id: string;
  material: { name: string; category: string };
  partner: { name: string };
  quantityEstimated: number;
  locationAddress: string | null;
};

type Operator = { id: string; name: string };
type Vehicle  = { id: string; name: string; plate: string | null; type: string | null };

const CATEGORY_ICONS: Record<string, string> = {
  PLASTIC: "♻️", METAL: "⚙️", WOOD: "🪵", ELECTRONIC: "💻",
  PAPER: "📦", GLASS: "🔷", TEXTILE: "👕", OTHER: "🗃️",
};

export default function CollectionForm({
  listings,
  operators,
  vehicles,
  preselectedId,
}: {
  listings: Listing[];
  operators: Operator[];
  vehicles: Vehicle[];
  preselectedId?: string;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>(
    preselectedId ? [preselectedId] : []
  );
  const [scheduledDate, setScheduledDate] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAll() {
    setSelectedIds(selectedIds.length === listings.length ? [] : listings.map((l) => l.id));
  }

  function toggleListing(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setError("Sélectionne au moins une annonce.");
      return;
    }
    setError(null);
    setLoading(true);

    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduledDate,
        operatorId: operatorId || null,
        vehicleId: vehicleId || null,
        notes,
        listingIds: selectedIds,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Erreur lors de la création.");
      setLoading(false);
      return;
    }

    const { id } = await res.json();
    router.push(`/collections/${id}`);
  }

  const allSelected = listings.length > 0 && selectedIds.length === listings.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < listings.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sélecteur d'annonces — tableau */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Annonces à collecter
              {selectedIds.length > 0 && (
                <span className="ml-2 text-xs font-normal text-emerald-600">
                  {selectedIds.length} sélectionnée{selectedIds.length > 1 ? "s" : ""}
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Seules les annonces planifiées sont disponibles.</p>
          </div>
        </div>

        {listings.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-gray-400 mb-2">Aucune annonce planifiée disponible.</p>
            <Link href="/listings?status=SUBMITTED" className="text-xs text-emerald-600 hover:text-emerald-700">
              Voir les annonces en attente →
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="w-10 px-5 py-3">
                  <button
                    type="button"
                    onClick={toggleAll}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      allSelected
                        ? "border-emerald-500 bg-emerald-500"
                        : someSelected
                        ? "border-emerald-400 bg-emerald-100"
                        : "border-gray-300"
                    }`}
                  >
                    {(allSelected || someSelected) && (
                      <svg className="w-2.5 h-2.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={allSelected ? 3 : 3} d={allSelected ? "M5 13l4 4L19 7" : "M5 12h14"} />
                      </svg>
                    )}
                  </button>
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-3">Matière</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-3">Fournisseur</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-3">Quantité</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Adresse</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {listings.map((listing) => {
                const selected = selectedIds.includes(listing.id);
                const icon = CATEGORY_ICONS[listing.material.category] ?? "🗃️";
                return (
                  <tr
                    key={listing.id}
                    onClick={() => toggleListing(listing.id)}
                    className={`cursor-pointer transition-colors ${
                      selected ? "bg-emerald-50 hover:bg-emerald-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-5 py-3">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        selected ? "border-emerald-500 bg-emerald-500" : "border-gray-300"
                      }`}>
                        {selected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{icon}</span>
                        <span className="text-sm font-medium text-gray-900">{listing.material.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{listing.partner.name}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{listing.quantityEstimated} t</td>
                    <td className="px-4 py-3 text-sm text-gray-400 hidden md:table-cell max-w-[160px] truncate">
                      {listing.locationAddress ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Détails */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Détails</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Date planifiée <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Opérateur</label>
            <select
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            >
              <option value="">— Non assigné</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>{op.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Sélecteur de véhicule */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Véhicule</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setVehicleId("")}
              className={`p-3 rounded-lg border text-left transition-all ${
                vehicleId === ""
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="text-sm text-gray-400">— Aucun</p>
            </button>
            {vehicles.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVehicleId(v.id)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  vehicleId === v.id
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="text-sm font-medium text-gray-900 leading-tight">{v.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {v.plate ?? ""}{v.type ? ` · ${v.type}` : ""}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes internes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Instructions spécifiques, accès, horaires..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
          <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Link
          href="/collections"
          className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Annuler
        </Link>
        <button
          type="submit"
          disabled={loading || selectedIds.length === 0}
          className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-medium transition-colors"
        >
          {loading
            ? "Création..."
            : selectedIds.length > 0
            ? `Créer la collecte (${selectedIds.length} annonce${selectedIds.length > 1 ? "s" : ""})`
            : "Créer la collecte"}
        </button>
      </div>
    </form>
  );
}
