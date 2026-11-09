import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareView } from "@/components/compare/compare-view";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Compare locations" };

export default function ComparePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <CompareView />
    </Suspense>
  );
}
