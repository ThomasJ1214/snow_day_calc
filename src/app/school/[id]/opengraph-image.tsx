import { ImageResponse } from "next/og";
import { getSchool } from "@/lib/schools/repo";
import { getSchoolPrediction } from "@/lib/forecast/school";
import { parseSchoolId } from "@/lib/schools/types";
import { OG_SIZE, OgCard, ogFonts } from "@/lib/og/card";

export const alt = "School snow day odds";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 900;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = parseSchoolId(id) ? (await getSchool(id).catch(() => null))?.value : null;
  const p = s ? await getSchoolPrediction(s).catch(() => null) : null;
  const pred = p?.ok ? p.data.prediction : null;
  const day = p?.ok ? p.data.targetDayLabel.split(",")[0] : "the next school day";
  return new ImageResponse(
    <OgCard
      eyebrow={s ? `${s.city ?? ""}${s.city ? ", " : ""}${s.state}` : "School snow day odds"}
      title={s?.name ?? "School snow day odds"}
      big={pred ? `${pred.closurePct}%` : "—"}
      bigLabel={`chance of closing ${day}`}
      detail={pred ? `${pred.delayPct}% chance of a delay` : "Prediction updates with every forecast"}
      footer="Prediction, not an official announcement"
    />,
    { ...size, fonts: await ogFonts() },
  );
}
