import { ImageResponse } from "next/og";
import { OG_SIZE, OgCard, ogFonts } from "@/lib/og/card";

export const alt = "SnowDay: how much snow, and whether school closes";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <OgCard eyebrow="Snowfall and school closure forecasts" title="How much snow. Whether school closes." big="82" bigLabel="forecast runs per place" detail="Honest low, likely and high totals" footer="Every U.S. ZIP code and school" />,
    { ...size, fonts: await ogFonts() },
  );
}
