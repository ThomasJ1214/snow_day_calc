import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { SchoolView } from "@/components/school/school-view";
import { getSchool } from "@/lib/schools/repo";
import { parseSchoolId } from "@/lib/schools/types";

const loadSchool = cache(async (id: string) => (await getSchool(id).catch(() => null))?.value ?? null);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const s = parseSchoolId(id) ? await loadSchool(id) : null;
  if (!s) return { title: "School snow day prediction" };
  const where = [s.city, s.state].filter(Boolean).join(", ");
  return {
    title: `${s.name} snow day prediction`,
    alternates: { canonical: `/school/${id}` },
    description: `Chance ${s.name}${where ? ` in ${where}` : ""} closes or delays for snow and ice, with the reasons, the morning commute forecast and ${s.district ?? "the district"}'s official status.`,
  };
}

export default async function SchoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!parseSchoolId(id)) notFound();
  const school = await loadSchool(id);
  return <SchoolView id={id} initialSchool={school} />;
}
