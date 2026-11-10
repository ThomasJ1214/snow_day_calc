import { ImageResponse } from "next/og";
import { decodeSlug } from "@/lib/geo/slug";
import { getLocationForecast } from "@/lib/forecast/service";
import { OG_SIZE, OgCard, ogFonts } from "@/lib/og/card";

export const alt = "Snowfall forecast";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 900;

const inch = (cm: number) => {
  const v = cm / 2.54;
  return v >= 10 ? `${Math.round(v)}″` : `${Math.round(v * 10) / 10}″`;
};

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const p = decodeSlug((await params).slug);
  const name = p?.name ?? "Snowfall forecast";
  const f = p ? await getLocationForecast(p.lat, p.lon).catch(() => null) : null;
  const w = f?.ok ? f.data.snow.windows["72"] : null;
  return new ImageResponse(
    <OgCard
      eyebrow="Snowfall forecast, next 72 hours"
      title={name}
      big={w ? inch(w.likely) : "—"}
      bigLabel={w ? (w.high === 0 ? "No snow expected" : "most likely") : "Forecast loading"}
      detail={w && w.high > 0 ? `Range ${inch(w.low)} to ${inch(w.high)}` : "From 80+ forecast model runs"}
      footer="Live forecast at Snow Day Scout"
    />,
    { ...size, fonts: await ogFonts() },
  );
}
