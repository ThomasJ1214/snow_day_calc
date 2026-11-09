"use client";
import { Button } from "@/components/ui/primitives";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-10">
      <h1 className="font-display text-3xl font-bold">This page hit a snag.</h1>
      <p className="text-text-2">A data source may be temporarily unavailable. Your saved schools and places are safe.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
