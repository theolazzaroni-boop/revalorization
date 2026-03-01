"use client";

import { useState } from "react";

type Item = {
  id: string;
  label: string;
  checked: boolean;
  order: number;
};

const DEFAULT_ITEMS = [
  "EPI vérifiés (gants, chaussures de sécurité, gilet)",
  "Véhicule vérifié (carburant, documents)",
  "Bons de collecte imprimés",
  "Téléphone chargé",
  "Contacts fournisseurs disponibles",
];

export default function ChecklistManager({
  collectionId,
  initialItems,
  canEdit,
}: {
  collectionId: string;
  initialItems: Item[];
  canEdit: boolean;
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [showDefaults, setShowDefaults] = useState(false);

  const toggle = async (item: Item) => {
    const updated = { ...item, checked: !item.checked };
    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    await fetch(`/api/collections/${collectionId}/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked: updated.checked }),
    });
  };

  const addItem = async (label: string) => {
    if (!label.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/collections/${collectionId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() }),
      });
      const created = await res.json();
      setItems((prev) => [...prev, created]);
      setNewLabel("");
      setShowDefaults(false);
    } finally {
      setAdding(false);
    }
  };

  const deleteItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/collections/${collectionId}/checklist/${id}`, { method: "DELETE" });
  };

  const checkedCount = items.filter((i) => i.checked).length;
  const allDone = items.length > 0 && checkedCount === items.length;

  return (
    <div className="divide-y divide-gray-50">
      {/* Barre de progression */}
      {items.length > 0 && (
        <div className="px-5 py-3 bg-gray-50 flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${allDone ? "bg-emerald-500" : "bg-amber-400"}`}
              style={{ width: `${(checkedCount / items.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-500 flex-shrink-0">
            {checkedCount}/{items.length}
          </span>
          {allDone && (
            <span className="text-xs font-medium text-emerald-600">✓ Complète</span>
          )}
        </div>
      )}

      {/* Liste des items */}
      {items.length === 0 && !canEdit && (
        <div className="px-5 py-8 text-center text-sm text-gray-400">
          Aucun item dans la checklist.
        </div>
      )}

      {items.map((item) => (
        <div
          key={item.id}
          className={`px-5 py-3 flex items-center gap-3 group transition-colors ${
            item.checked ? "bg-emerald-50" : "hover:bg-gray-50"
          }`}
        >
          <button
            onClick={() => toggle(item)}
            className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all ${
              item.checked
                ? "bg-emerald-500 border-emerald-500 text-white"
                : "border-gray-300 hover:border-emerald-400"
            }`}
            aria-label={item.checked ? "Décocher" : "Cocher"}
          >
            {item.checked && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <span className={`flex-1 text-sm ${item.checked ? "line-through text-gray-400" : "text-gray-700"}`}>
            {item.label}
          </span>
          {canEdit && (
            <button
              onClick={() => deleteItem(item.id)}
              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-lg leading-none"
              aria-label="Supprimer"
            >
              ×
            </button>
          )}
        </div>
      ))}

      {/* Ajouter un item */}
      {canEdit && (
        <div className="px-5 py-4">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem(newLabel)}
              placeholder="Ajouter un item..."
              className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder-gray-300"
            />
            <button
              onClick={() => addItem(newLabel)}
              disabled={!newLabel.trim() || adding}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              +
            </button>
          </div>

          {/* Items par défaut */}
          <button
            onClick={() => setShowDefaults((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 transition"
          >
            {showDefaults ? "▲ Masquer les suggestions" : "▼ Suggestions rapides"}
          </button>
          {showDefaults && (
            <div className="mt-2 space-y-1">
              {DEFAULT_ITEMS.filter(
                (d) => !items.some((i) => i.label.toLowerCase() === d.toLowerCase())
              ).map((d) => (
                <button
                  key={d}
                  onClick={() => addItem(d)}
                  className="w-full text-left text-xs text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded px-2 py-1 transition"
                >
                  + {d}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
