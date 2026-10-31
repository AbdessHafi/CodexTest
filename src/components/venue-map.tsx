"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Venue } from "@/lib/demo";
export default function VenueMap({ venues }: { venues: Venue[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [2.35, 46.6],
      zoom: 5,
    });
    map.addControl(new maplibregl.NavigationControl());
    map.on("error", () => setFailed(true));
    const bounds = new maplibregl.LngLatBounds();
    for (const v of venues) {
      const content = document.createElement("div");
      const link = document.createElement("a");
      link.href = `/lieux/${v.slug}`;
      link.textContent = `${v.name} · ${v.city}`;
      content.append(link);
      new maplibregl.Marker({ color: "#6b782d" })
        .setLngLat([v.longitude, v.latitude])
        .setPopup(new maplibregl.Popup().setDOMContent(content))
        .addTo(map);
      bounds.extend([v.longitude, v.latitude]);
    }
    if (venues.length)
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 });
    return () => map.remove();
  }, [venues]);
  return (
    <div>
      {failed && (
        <p role="status">
          Fond de carte indisponible. Les adresses restent accessibles dans la
          liste.
        </p>
      )}
      <div
        className="venue-map"
        ref={container}
        role="region"
        aria-label="Carte des établissements"
      />
      <p className="demo-note">
        Fond de carte OpenStreetMap : votre adresse IP est transmise au
        fournisseur lors de l’affichage. Usage léger de démonstration ; prévoir
        un fournisseur de tuiles pour la production.
      </p>
    </div>
  );
}
