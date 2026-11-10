"use client";
import { cn } from "@/components/ui/primitives";
import { useTween } from "@/lib/client/use-tween";

/**
 * One bar split into the three outcomes for the next school day. The segments grow out of the
 * empty track together with their numbers when the prediction arrives, and glide when it updates.
 */
export function OddsBar({ closure, delay }: { closure: number; delay: number }) {
  const normal = Math.max(0, 100 - closure - delay);
  const c = useTween(closure, 900);
  const d = useTween(delay, 900);
  const n = useTween(normal, 900);
  return (
    <div>
      <div className="neu-inset flex h-6 w-full gap-0.5 overflow-hidden rounded-full p-1" role="img" aria-label={`${closure}% closure, ${delay}% delay, ${normal}% normal day`}>
        <div className="rounded-full bg-rose" style={{ width: `${c}%` }} />
        <div className="rounded-full bg-amber" style={{ width: `${d}%` }} />
        <div className="rounded-full bg-mint/45" style={{ width: `${n}%` }} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {[
          { label: "Closed", v: Math.round(c), c: "text-rose", dot: "bg-rose" },
          { label: "Delayed", v: Math.round(d), c: "text-amber", dot: "bg-amber" },
          { label: "Normal day", v: Math.round(n), c: "text-mint", dot: "bg-mint/60" },
        ].map((x) => (
          <div key={x.label}>
            <dt className="flex items-center gap-1.5 text-sm text-text-3">
              <span className={cn("size-2.5 rounded-full", x.dot)} aria-hidden /> {x.label}
            </dt>
            <dd className={cn("font-display text-4xl font-extrabold tabular sm:text-5xl", x.c)}>{x.v}%</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
