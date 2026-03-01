"use client";

import dynamic from "next/dynamic";
import type { MapPin } from "./CollectionMap";

const CollectionMap = dynamic(() => import("./CollectionMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
      <p className="text-gray-400 text-sm">Chargement de la carte…</p>
    </div>
  ),
});

export default function MapWrapper({ pins }: { pins: MapPin[] }) {
  return <CollectionMap pins={pins} />;
}
