import { ImageResponse } from "next/og";
import { OG_SIZE, OgCard, ogFonts } from "@/lib/og/card";

export const alt = "Snow Day Scout: will there be a snow day? See the odds before the call.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <OgCard eyebrow="Snow day predictions for every U.S. school" title="Will there be a snow day?" big="82" bigLabel="forecast runs per place" detail="Honest low, likely and high totals" footer="Every U.S. ZIP code and school" />,
    { ...size, fonts: await ogFonts() },
  );
}
