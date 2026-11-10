"use client";
import { useTween } from "@/lib/client/use-tween";

/** A number that counts up when data arrives and glides when it changes. Screen readers get the final value. */
export function TweenNumber({ value, format, duration }: { value: number; format: (v: number) => string; duration?: number }) {
  const v = useTween(value, duration);
  return (
    <>
      <span aria-hidden>{format(v)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
