"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { GeoJSONSource, Map as MlMap, MapMouseEvent } from "maplibre-gl";
import { Pause, Play } from "lucide-react";
import { encodeSlug } from "@/lib/geo/slug";
import { OVERLAY_BOUNDS as OB, SNOW_SCALE } from "@/lib/national/scale";
import { cn } from "@/components/ui/primitives";

export interface MapCity {
  name: string;
  state: string;
  lat: number;
  lon: number;
  total72Cm: number | null;
  daysCm: (number | null)[];
  featured?: boolean;
}

type LayerId = "hrrr6" | "hrrr12" | "hrrr18" | "wpc1" | "wpc2" | "wpc3" | "depth";
const LAYERS: { id: LayerId; label: string; group: string }[] = [
  { id: "hrrr6", label: "+6 h", group: "HRRR snowfall (NOAA GRIB2)" },
  { id: "hrrr12", label: "+12 h", group: "HRRR snowfall (NOAA GRIB2)" },
  { id: "hrrr18", label: "+18 h", group: "HRRR snowfall (NOAA GRIB2)" },
  { id: "wpc1", label: "24 h", group: "Chance of 4″+ (NOAA WPC)" },
  { id: "wpc2", label: "48 h", group: "Chance of 4″+ (NOAA WPC)" },
  { id: "wpc3", label: "72 h", group: "Chance of 4″+ (NOAA WPC)" },
  { id: "depth", label: "Now", group: "Snow on the ground (NOHRSC)" },
];
const WPC_LAYER: Record<string, number> = { wpc1: 1, wpc2: 6, wpc3: 11 };
const WPC = "https://mapservices.weather.noaa.gov/vector/rest/services/precip/wpc_prob_winter_precip/MapServer/export";
const NOHRSC = "https://mapservices.weather.noaa.gov/raster/rest/services/snow/NOHRSC_Snow_Analysis/MapServer/export";
const tiles = (base: string, show: string) =>
  `${base}?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&layers=show:${show}&f=image`;
const BOUNDS: [[number, number], [number, number], [number, number], [number, number]] = [
  [OB.west, OB.north],
  [OB.east, OB.north],
  [OB.east, OB.south],
  [OB.west, OB.south],
];

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
const getThemeName = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function styleUrl() {
  return document.documentElement.dataset.theme === "dark"
    ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
    : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
}

export function SnowMap({
  center = [-96, 39],
  zoom = 3.3,
  cities = [],
  marker,
  className,
  initialLayer = "hrrr18",
}: {
  center?: [number, number];
  zoom?: number;
  cities?: MapCity[];
  marker?: { lat: number; lon: number; label: string };
  className?: string;
  initialLayer?: LayerId;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const router = useRouter();
  const [layer, setLayer] = useState<LayerId>(initialLayer);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const theme = useSyncExternalStore(subscribeTheme, getThemeName, () => "light");

  useEffect(() => {
    let disposed = false;
    (async () => {
      const maplibre = await import("maplibre-gl");
      maplibre.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      if (disposed || !el.current) return;
      const m = new maplibre.Map({ container: el.current, style: styleUrl(), center, zoom, attributionControl: { compact: true }, cooperativeGestures: false });
      map.current = m;
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      m.on("error", (e) => {
        if (String(e.error?.message ?? "").includes("style")) setFailed(true);
      });
      m.on("load", () => {
        for (const lead of [6, 12, 18]) {
          m.addSource(`hrrr${lead}`, { type: "image", url: `/api/national/hrrr/${lead}`, coordinates: BOUNDS });
          m.addLayer({ id: `hrrr${lead}`, type: "raster", source: `hrrr${lead}`, paint: { "raster-opacity": 0.85, "raster-fade-duration": 250 }, layout: { visibility: "none" } });
        }
        for (const id of ["wpc1", "wpc2", "wpc3"]) {
          m.addSource(id, { type: "raster", tiles: [tiles(WPC, String(WPC_LAYER[id]))], tileSize: 256, attribution: "NOAA WPC" });
          m.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": 0.7 }, layout: { visibility: "none" } });
        }
        m.addSource("depth", { type: "raster", tiles: [tiles(NOHRSC, "0")], tileSize: 256, attribution: "NOAA NOHRSC" });
        m.addLayer({ id: "depth", type: "raster", source: "depth", paint: { "raster-opacity": 0.75 }, layout: { visibility: "none" } });

        m.addSource("cities", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addLayer({
          id: "cities-dot",
          type: "circle",
          source: "cities",
          paint: {
            "circle-radius": ["case", ["get", "featured"], 7, 4.5],
            "circle-color": ["case", [">=", ["get", "inches"], 0.1], theme === "dark" ? "#8cc8ff" : "#1c64a8", theme === "dark" ? "#64748b" : "#94a3b8"],
            "circle-stroke-color": theme === "dark" ? "#1b2335" : "#ffffff",
            "circle-stroke-width": 1.5,
          },
        });
        m.addLayer({
          id: "cities-label",
          type: "symbol",
          source: "cities",
          layout: { "text-field": ["get", "label"], "text-size": 11, "text-offset": [0, 1.2], "text-anchor": "top", "text-optional": true },
          paint: { "text-color": theme === "dark" ? "#e8eef7" : "#18233b", "text-halo-color": theme === "dark" ? "#1b2335" : "#ffffff", "text-halo-width": 1.4 },
        });
        m.on("click", "cities-dot", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as { name: string; lat: number; lon: number };
          router.push(`/forecast/${encodeSlug({ name: p.name, lat: Number(p.lat), lon: Number(p.lon) })}`);
        });
        m.on("mouseenter", "cities-dot", () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", "cities-dot", () => (m.getCanvas().style.cursor = ""));
        m.on("click", async (e: MapMouseEvent) => {
          if (m.queryRenderedFeatures(e.point, { layers: ["cities-dot"] }).length) return;
          const { lat, lng } = e.lngLat;
          const popup = new maplibre.Popup({ closeButton: true, maxWidth: "260px" }).setLngLat(e.lngLat).setHTML(`<p style="font-size:14px">Finding this place…</p>`).addTo(m);
          try {
            const r = await fetch(`/api/reverse?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`);
            if (!r.ok) throw new Error();
            const { place } = await r.json();
            const href = `/forecast/${encodeSlug({ name: place.name, lat, lon: lng })}`;
            const div = document.createElement("div");
            const title = document.createElement("p");
            title.textContent = place.name;
            title.style.cssText = "font-weight:600;margin-bottom:6px";
            const a = document.createElement("a");
            a.href = href;
            a.textContent = "Open snowfall forecast";
            a.style.cssText = "color:var(--ice);font-weight:600;text-decoration:underline";
            a.onclick = (ev) => {
              ev.preventDefault();
              router.push(href);
            };
            div.append(title, a);
            popup.setDOMContent(div);
          } catch {
            popup.setHTML(`<p style="font-size:14px">Snow Day Scout forecasts cover the United States.</p>`);
          }
        });
        if (marker) new maplibre.Marker({ color: theme === "dark" ? "#b6a2ff" : "#5b3fc4" }).setLngLat([marker.lon, marker.lat]).setPopup(new maplibre.Popup().setText(marker.label)).addTo(m);
        setReady(true);
      });
    })();
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    for (const l of LAYERS) if (m.getLayer(l.id)) m.setLayoutProperty(l.id, "visibility", l.id === layer ? "visible" : "none");
  }, [layer, ready]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const src = m.getSource("cities") as GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: cities.map((c) => {
        const inches = c.total72Cm == null ? 0 : c.total72Cm / 2.54;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [c.lon, c.lat] },
          properties: { name: `${c.name}, ${c.state}`, lat: c.lat, lon: c.lon, featured: Boolean(c.featured), inches, label: `${c.name} ${inches >= 0.1 ? `${inches.toFixed(1)}″` : "0″"}` },
        };
      }),
    });
  }, [cities, ready]);

  useEffect(() => {
    if (!playing) return;
    const seq: LayerId[] = ["hrrr6", "hrrr12", "hrrr18"];
    const id = setInterval(() => setLayer((l) => seq[(seq.indexOf(l) + 1) % seq.length] ?? "hrrr6"), 1400);
    return () => clearInterval(id);
  }, [playing]);

  const groups = [...new Set(LAYERS.map((l) => l.group))];
  const isHrrr = layer.startsWith("hrrr");
  return (
    <div className={cn("neu-raised-lg overflow-hidden rounded-[28px] p-2.5", className)}>
      <div className="neu-inset relative h-[420px] w-full overflow-hidden rounded-[22px] p-1 sm:h-[520px]">
        <div ref={el} className="h-full w-full overflow-hidden rounded-[18px]" aria-label="Interactive snowfall map. Click anywhere for that location's forecast." role="region" />
        {failed && <p className="neu-raised absolute inset-x-4 top-4 rounded-2xl p-3 text-sm text-text-2">The basemap couldn&apos;t load. Snowfall layers may still appear.</p>}
        <div className="neu-raised absolute bottom-4 left-4 max-w-[calc(100%-2rem)] rounded-2xl p-3 text-xs">
          {isHrrr ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {SNOW_SCALE.map((s) => (
                <span key={s.label} className="inline-flex items-center gap-1 text-text-2">
                  <span className="size-3 rounded-sm" style={{ background: `rgba(${s.rgba.join(",")})` }} />
                  {s.label}
                </span>
              ))}
            </div>
          ) : layer === "depth" ? (
            <p className="text-text-2">Modeled snow depth from NOAA&apos;s National Operational Hydrologic Remote Sensing Center.</p>
          ) : (
            <p className="text-text-2">Shaded areas: NOAA Weather Prediction Center chance of at least 4″ (light 10%+, medium 40%+, dark 70%+).</p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3 px-2 pb-2 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          onClick={() => {
            if (!isHrrr) setLayer("hrrr6");
            setPlaying((p) => !p);
          }}
          aria-pressed={playing}
          className="neu-raised-sm neu-press inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-2xl bg-accent! px-4 text-sm font-semibold text-on-accent"
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {playing ? "Pause" : "Animate next 18 h"}
        </button>
        {groups.map((g) => (
          <div key={g} role="radiogroup" aria-label={g} className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-text-3">{g}</span>
            {LAYERS.filter((l) => l.group === g).map((l) => (
              <button
                key={l.id}
                role="radio"
                aria-checked={layer === l.id}
                onClick={() => {
                  setPlaying(false);
                  setLayer(l.id);
                }}
                className={cn("neu-raised-sm neu-press min-h-11 cursor-pointer rounded-xl px-4 text-xs font-semibold", layer === l.id ? "text-ice" : "text-text-2 hover:text-text")}
              >
                {l.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
