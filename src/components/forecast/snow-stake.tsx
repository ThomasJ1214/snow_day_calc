"use client";
import { CM_PER_IN } from "@/lib/client/format";
import { useTween } from "@/lib/client/use-tween";

/**
 * The snow stake: a graduated measuring pole. Snowpack fills to the most-likely depth; the frosted
 * band spans the low–high range (10th–90th percentile of ensemble members).
 * Signature motion: when a forecast arrives the snow settles into the well from the ground up,
 * in step with the headline number (same duration and curve); refreshed forecasts glide to the new depth.
 * The scale is fixed by the target values so the ruler never moves while the snow does.
 */
export function SnowStake({ lowCm, likelyCm, highCm, height = 260, title }: { lowCm: number; likelyCm: number; highCm: number; height?: number; title: string }) {
  const lo = useTween(lowCm) / CM_PER_IN;
  const li = useTween(likelyCm) / CM_PER_IN;
  const hi = useTween(highCm) / CM_PER_IN;
  const maxIn = niceMax(Math.max((highCm / CM_PER_IN) * 1.15, 4));
  const step = maxIn <= 6 ? 1 : maxIn <= 12 ? 2 : maxIn <= 24 ? 4 : 6;
  const W = 150;
  const top = 14;
  const bottom = height - 18;
  const y = (v: number) => bottom - (Math.min(v, maxIn) / maxIn) * (bottom - top);
  const ticks = Array.from({ length: Math.floor(maxIn / step) + 1 }, (_, i) => i * step);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`${title}: most likely ${round(likelyCm / CM_PER_IN)} inches, range ${round(lowCm / CM_PER_IN)} to ${round(highCm / CM_PER_IN)} inches`} className="h-auto w-full max-w-[170px]">
      <defs>
        <pattern id="frost" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="6" height="6" fill="var(--ice)" opacity="0.12" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ice)" strokeWidth="1.4" opacity="0.35" />
        </pattern>
      </defs>
      {/* debossed well the snow collects in */}
      <rect x="14" y={top - 2} width="80" height={bottom - top + 4} rx="10" fill="var(--sh-light)" />
      <rect x="12" y={top - 4} width="80" height={bottom - top + 4} rx="10" fill="var(--sh-dark)" opacity="0.55" />
      <rect x="14" y={top - 2} width="78" height={bottom - top + 2} rx="9" fill="var(--bg)" />
      {/* ground */}
      <rect x="6" y={bottom} width={W - 12} height="2.5" rx="1.25" fill="var(--line-strong)" />
      {/* range band */}
      {hi > 0.01 && <rect x="16" y={y(hi)} width="76" height={Math.max(2, y(lo) - y(hi))} rx="6" fill="url(#frost)" />}
      {/* snowpack */}
      {li > 0.01 && <rect x="16" y={y(li)} width="76" height={bottom - y(li)} rx="8" fill="var(--snowpack)" stroke="var(--line-strong)" strokeWidth="0.8" />}
      {/* stake */}
      <rect x="101" y={top - 6} width="10" height={bottom - top + 6} rx="5" fill="var(--pole)" />
      {ticks.map((t) => (
        <g key={t}>
          <rect x="112" y={y(t) - 0.75} width={t % (step * 2) === 0 ? 10 : 6} height="1.5" fill="var(--text-2)" />
          <text x="126" y={y(t) + 4} fontSize="11" fill="var(--text-3)" className="tabular">
            {t}″
          </text>
        </g>
      ))}
      {hi > 0.01 && (
        <>
          <line x1="16" x2="96" y1={y(hi)} y2={y(hi)} stroke="var(--ice)" strokeDasharray="3 3" strokeWidth="1" />
          <line x1="16" x2="96" y1={y(lo)} y2={y(lo)} stroke="var(--ice)" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" />
        </>
      )}
    </svg>
  );
}

function niceMax(v: number) {
  for (const n of [4, 6, 8, 12, 18, 24, 36, 48, 72]) if (v <= n) return n;
  return Math.ceil(v / 12) * 12;
}
const round = (v: number) => Math.round(v * 10) / 10;
