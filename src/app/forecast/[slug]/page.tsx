import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { decodeSlug } from "@/lib/geo/slug";
import { LocationView } from "@/components/forecast/location-view";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = decodeSlug(slug);
  return p
    ? { title: `${p.name} snowfall forecast`, description: `Hourly snowfall, low/likely/high totals and NWS alerts for ${p.name}.`, alternates: { canonical: `/forecast/${slug}` } }
    : { title: "Forecast" };
}

export default async function ForecastPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = decodeSlug((await params).slug);
  if (!p || p.lat < 13 || p.lat > 72 || p.lon < -180 || p.lon > -64) notFound();
  return <LocationView name={p.name} lat={p.lat} lon={p.lon} />;
}
