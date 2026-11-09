// Copies MapLibre's ES-module worker into public/ so it can be served as a static file
// (Turbopack does not bundle MapLibre's `new URL(..., import.meta.url)` worker reference).
import fs from "node:fs";
import path from "node:path";
const src = path.join(process.cwd(), "node_modules/maplibre-gl/dist");
const dst = path.join(process.cwd(), "public/maplibre");
fs.mkdirSync(dst, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) fs.copyFileSync(path.join(src, f), path.join(dst, f));
console.log("MapLibre worker copied to public/maplibre/");
