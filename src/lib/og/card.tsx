/** Shared neumorphic share-card layout for Open Graph images (rendered by next/og / Satori). */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const fontDir = join(process.cwd(), "src/lib/og/fonts");
let fonts: Promise<{ name: string; data: Buffer; weight: 600 | 800; style: "normal" }[]> | null = null;
/** Bricolage Grotesque (SIL OFL 1.1), bundled as static WOFF so share images match the site. */
export function ogFonts() {
  fonts ??= Promise.all([
    readFile(join(fontDir, "bricolage-800.woff")).then((data) => ({ name: "Bricolage", data, weight: 800 as const, style: "normal" as const })),
    readFile(join(fontDir, "bricolage-600.woff")).then((data) => ({ name: "Bricolage", data, weight: 600 as const, style: "normal" as const })),
  ]);
  return fonts;
}
export const OG_SIZE = { width: 1200, height: 630 };
const BG = "#e3eaf2";
const DARK = "rgba(150,166,190,0.55)";
const LIGHT = "rgba(255,255,255,0.95)";

export function OgCard({ eyebrow, title, big, bigLabel, detail, footer }: { eyebrow: string; title: string; big: string; bigLabel: string; detail: string; footer: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: BG, padding: 56, fontFamily: "Bricolage", color: "#18233b" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          borderRadius: 44,
          background: BG,
          padding: "52px 60px",
          boxShadow: `18px 18px 40px ${DARK}, -18px -18px 40px ${LIGHT}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "#4f5c76" }}>{eyebrow}</div>
          <div style={{ display: "flex", fontSize: title.length > 34 ? 52 : 64, fontWeight: 800, letterSpacing: -2, marginTop: 8, lineHeight: 1.05 }}>{title}</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 28 }}>
          <div style={{ display: "flex", fontSize: 150, fontWeight: 800, letterSpacing: -6, lineHeight: 0.9, color: "#1c64a8" }}>{big}</div>
          <div style={{ display: "flex", flexDirection: "column", paddingBottom: 10 }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>{bigLabel}</div>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "#364460", marginTop: 6 }}>{detail}</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, fontWeight: 600, color: "#4f5c76" }}>
          <div style={{ display: "flex", fontWeight: 800, color: "#18233b" }}>SnowDay</div>
          <div style={{ display: "flex" }}>{footer}</div>
        </div>
      </div>
    </div>
  );
}
