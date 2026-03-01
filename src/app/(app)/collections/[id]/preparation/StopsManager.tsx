"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Stop = {
  id: string;
  order: number;
  note: string | null;
  scheduledTime: string | null;
  partner: string;
  phone: string | null;
  address: string;
  material: string;
  materialCategory: string;
  quantity: number;
  unit: string;
  condition: string | null;
  listingId: string;
};

function SortableStop({
  stop,
  index,
  icon,
  canEdit,
  onNoteChange,
  onNoteBlur,
}: {
  stop: Stop;
  index: number;
  icon: string;
  canEdit: boolean;
  onNoteChange: (id: string, note: string) => void;
  onNoteBlur: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const unitLabels: Record<string, string> = {
    KG: "kg", TONNE: "t", M3: "m³", UNIT: "unité(s)",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border-b border-gray-100 last:border-0"
    >
      <div className="px-5 py-4 flex gap-4">
        {/* Numéro + poignée */}
        <div className="flex flex-col items-center gap-2 pt-1">
          <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0">
            {index + 1}
          </span>
          {canEdit && (
            <button
              {...attributes}
              {...listeners}
              className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
              aria-label="Réordonner"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm6-16a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
              </svg>
            </button>
          )}
        </div>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">{stop.partner}</p>
              {stop.address && (
                <p className="text-xs text-gray-400 mt-0.5">{stop.address}</p>
              )}
              {stop.phone && (
                <p className="text-xs text-gray-400">{stop.phone}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-sm font-medium text-gray-700">
                {icon} {stop.material}
              </span>
              <p className="text-xs text-gray-400">
                {stop.quantity} {unitLabels[stop.unit] ?? stop.unit}
                {stop.condition ? ` · ${stop.condition}` : ""}
              </p>
            </div>
          </div>

          {/* Note opérateur */}
          {canEdit ? (
            <textarea
              value={stop.note ?? ""}
              onChange={(e) => onNoteChange(stop.id, e.target.value)}
              onBlur={() => onNoteBlur(stop.id)}
              placeholder="Note pour cet arrêt..."
              rows={1}
              className="w-full text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder-gray-300"
            />
          ) : (
            stop.note && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mt-1">
                {stop.note}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function StopsManager({
  collectionId,
  stops: initialStops,
  materialIcons,
  canEdit,
}: {
  collectionId: string;
  stops: Stop[];
  materialIcons: Record<string, string>;
  canEdit: boolean;
}) {
  const [stops, setStops] = useState(initialStops);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const persistOrder = useCallback(async (newStops: Stop[]) => {
    setSaving(true);
    try {
      await fetch(`/api/collections/${collectionId}/stops`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stops: newStops.map((s, i) => ({ id: s.id, order: i })),
        }),
      });
    } finally {
      setSaving(false);
    }
  }, [collectionId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stops.findIndex((s) => s.id === active.id);
    const newIndex = stops.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(stops, oldIndex, newIndex);
    setStops(reordered);
    persistOrder(reordered);
  };

  const handleNoteChange = (id: string, note: string) => {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, note } : s)));
  };

  const saveNote = async (id: string) => {
    const stop = stops.find((s) => s.id === id);
    if (!stop) return;
    await fetch(`/api/collections/${collectionId}/stops`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stops: [{ id, order: stop.order, note: stop.note ?? "" }] }),
    });
  };

  return (
    <div>
      {saving && (
        <div className="px-5 py-2 bg-emerald-50 text-emerald-600 text-xs flex items-center gap-2">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Sauvegarde...
        </div>
      )}

      {canEdit ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {stops.map((stop, i) => (
              <SortableStop
                key={stop.id}
                stop={stop}
                index={i}
                icon={materialIcons[stop.materialCategory] ?? "🗃️"}
                canEdit={canEdit}
                onNoteChange={handleNoteChange}
                onNoteBlur={saveNote}
              />
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        stops.map((stop, i) => (
          <SortableStop
            key={stop.id}
            stop={stop}
            index={i}
            icon={materialIcons[stop.materialCategory] ?? "🗃️"}
            canEdit={false}
            onNoteChange={() => {}}
            onNoteBlur={() => {}}
          />
        ))
      )}
    </div>
  );
}
