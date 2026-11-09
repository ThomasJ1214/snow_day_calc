import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SchoolView } from "@/components/school/school-view";
import { parseSchoolId } from "@/lib/schools/types";

export const metadata: Metadata = { title: "School snow day odds" };

export default async function SchoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!parseSchoolId(id)) notFound();
  return <SchoolView id={id} />;
}
