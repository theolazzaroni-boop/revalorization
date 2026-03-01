"use client";

import { useEffect, useRef } from "react";

export type MapPin = {
  lat: number;
  lng: number;
  label: string;
  partner: string;
  material: string;
  quantity: number;
  status: string;
  address: string;
};

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED:  "#3b82f6", // blue
  SCHEDULED:  "#f59e0b", // amber
  COLLECTED:  "#10b981", // emerald
  CANCELLED:  "#9ca3af", // gray
};

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED:  "Nouvelle",
  SCHEDULED:  "Planifiée",
  COLLECTED:  "Collectée",
  CANCELLED:  "Annulée",
};

/** Écarte les marqueurs qui se superposent exactement au même point */
function spreadOverlapping(pins: MapPin[]): (MapPin & { jitLat: number; jitLng: number })[] {
  const groups = new Map<string, number[]>();
  pins.forEach((pin, i) => {
    const key = `${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  });

  return pins.map((pin, i) => {
    const key = `${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`;
    const group = groups.get(key)!;
    if (group.length === 1) return { ...pin, jitLat: pin.lat, jitLng: pin.lng };

    const posInGroup = group.indexOf(i);
    const angle = (posInGroup / group.length) * 2 * Math.PI;
    const radius = 0.00025; // ~25 m
    return {
      ...pin,
      jitLat: pin.lat + Math.cos(angle) * radius,
      jitLng: pin.lng + Math.sin(angle) * radius,
    };
  });
}

export default function CollectionMap({ pins }: { pins: MapPin[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamic import of leaflet (client-only)
    import("leaflet").then((L) => {
      import("leaflet/dist/leaflet.css");

      if (!mapRef.current || mapInstanceRef.current) return;

      const spreadPins = spreadOverlapping(pins);

      const center: [number, number] = pins.length > 0
        ? [
            pins.reduce((s, p) => s + p.lat, 0) / pins.length,
            pins.reduce((s, p) => s + p.lng, 0) / pins.length,
          ]
        : [47.2, 5.9]; // Besançon default

      const map = L.map(mapRef.current, {
        center,
        zoom: pins.length > 1 ? 11 : 13,
        zoomControl: true,
      });

      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      spreadPins.forEach((pin) => {
        const color = STATUS_COLORS[pin.status] ?? "#6b7280";

        const circleMarker = L.circleMarker([pin.jitLat, pin.jitLng], {
          radius: 10,
          fillColor: color,
          color: "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(map);

        circleMarker.bindPopup(`
          <div style="font-family: -apple-system, sans-serif; min-width: 180px;">
            <p style="font-weight: 600; font-size: 14px; margin: 0 0 4px 0; color: #111827;">${pin.partner}</p>
            <p style="font-size: 13px; color: #6b7280; margin: 0 0 8px 0;">${pin.address}</p>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span style="font-size: 13px; color: #111827; font-weight: 500;">${pin.material} · ${pin.quantity} t</span>
              <span style="font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: ${color}22; color: ${color};">
                ${STATUS_LABELS[pin.status] ?? pin.status}
              </span>
            </div>
          </div>
        `);
      });

      // Fit bounds if multiple pins
      if (spreadPins.length > 1) {
        const bounds = L.latLngBounds(spreadPins.map((p) => [p.jitLat, p.jitLng] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [pins]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: "500px" }}
    />
  );
}
