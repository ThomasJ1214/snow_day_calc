"use client";
import { LazyMotion, MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Motion tokens. One family of curves for the whole site so every movement feels related:
 * - press:  a key going down (120 ms)
 * - state:  something changing state: toggles, menus opening, icons swapping (200 ms)
 * - reveal: content replacing a placeholder (320 ms)
 * - signature: the one choreographed moment, the snow stake filling with the forecast (1100 ms)
 * Entrances settle (fast start, long soft landing); exits are quicker and simply get out of the way.
 */
export const EASE = [0.2, 0.8, 0.2, 1] as const;
export const EASE_EXIT = [0.4, 0, 1, 1] as const;
export const DUR = { press: 0.12, state: 0.2, reveal: 0.32, signature: 1.1 } as const;

/** Slides (toggle pills, nav highlight): critically damped, so they arrive without bouncing. */
export const SLIDE = { type: "spring", bounce: 0, duration: 0.34 } as const;

/** Small surfaces appearing near their trigger (menus, panels). */
export const POP = {
  initial: { opacity: 0, y: -6, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: DUR.state, ease: EASE } },
  exit: { opacity: 0, y: -4, scale: 0.99, transition: { duration: 0.12, ease: EASE_EXIT } },
};

/** Placeholder → content. */
export const REVEAL = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DUR.reveal, ease: EASE } },
};

const features = () => import("./motion-features").then((m) => m.default);

/** Animation features load lazily; every animation honours the visitor's reduced-motion setting. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={features} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: DUR.state, ease: EASE }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
