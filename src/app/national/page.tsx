import type { Metadata } from "next";
import { NationalView } from "@/components/national/national-view";

export const metadata: Metadata = { title: "National snowfall map", description: "Snowfall forecast across the United States: HRRR, NOAA WPC odds and current snow cover." };

export default function NationalPage() {
  return <NationalView />;
}
