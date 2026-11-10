"use client";
import { useEffect, useRef, useState } from "react";

/** Approximates the site's settle curve, cubic-bezier(.2,.8,.2,1). */
export const settle = (p: number) => 1 - Math.pow(1 - p, 4);

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Tweens a number towards `target`: from 0 on first mount, then from wherever it is when the
 * target changes (a refreshed forecast glides to its new value instead of jumping).
 * Jumps straight to the value for reduced-motion visitors.
 */
export function useTween(target: number, duration = 1100, delay = 0): number {
  const [value, setValue] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const goal = Number.isFinite(target) ? target : 0;
    const from = current.current;
    const dur = prefersReducedMotion() ? 0 : duration;
    let raf = 0;
    let t0: number | null = null;
    const step = (now: number) => {
      t0 ??= now + (dur ? delay : 0);
      const p = dur === 0 ? 1 : Math.min(1, Math.max(0, (now - t0) / dur));
      const v = from + (goal - from) * settle(p);
      current.current = v;
      setValue(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return value;
}
