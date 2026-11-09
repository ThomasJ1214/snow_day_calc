import { CM_PER_IN } from "@/lib/client/format";

/**
 * The snow stake: a graduated measuring pole. Snowpack fills to the most-likely depth; the frosted
 * band spans the low–high range (10th–90th percentile of ensemble members).
 */
export function SnowStake({ lowCm, likelyCm, highCm, height = 260, title }: { lowCm: number; likelyCm: number; highCm: number; height?: number; title: string }) {
  const lo = lowCm / CM_PER_IN;
  const li = likelyCm / CM_PER_IN;
  const hi = highCm / CM_PER_IN;
  const maxIn = niceMax(Math.max(hi * 1.15, 4));
  const step = maxIn <= 6 ? 1 : maxIn <= 12 ? 2 : maxIn <= 24 ? 4 : 6;
  const W = 150;
  const top = 14;
  const bottom = height - 18;
  const y = (v: number) => bottom - (Math.min(v, maxIn) / maxIn) * (bottom - top);
  const ticks = Array.from({ length: Math.floor(maxIn / step) + 1 }, (_, i) => i * step);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`${title}: most likely ${round(li)} inches, range ${round(lo)} to ${round(hi)} inches`} className="h-auto w-full max-w-[170px]">
      <defs>
        <linearGradient id="stake" x1="0" x2="1">
          <stop offset="0" stopColor="var(--ice-2)" />
          <stop offset="1" stopColor="var(--violet)" />
        </linearGradient>
        <linearGradient id="pack" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--snowpack)" stopOpacity="1" />
          <stop offset="1" stopColor="var(--ice)" stopOpacity="0.55" />
        </linearGradient>
        <pattern id="frost" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="6" height="6" fill="var(--ice)" opacity="0.12" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ice)" strokeWidth="1.4" opacity="0.35" />
        </pattern>
      </defs>
      {/* ground */}
      <rect x="6" y={bottom} width={W - 12} height="3" rx="1.5" fill="var(--line-strong)" />
      {/* range band */}
      {hi > 0 && <rect x="14" y={y(hi)} width="78" height={Math.max(2, y(lo) - y(hi))} rx="6" fill="url(#frost)" />}
      {/* snowpack */}
      <rect x="14" y={y(li)} width="78" height={bottom - y(li)} rx="8" fill="url(#pack)" />
      {/* stake */}
      <rect x="100" y={top - 6} width="12" height={bottom - top + 6} rx="6" fill="url(#stake)" opacity="0.92" />
      {ticks.map((t) => (
        <g key={t}>
          <rect x="112" y={y(t) - 0.75} width={t % (step * 2) === 0 ? 10 : 6} height="1.5" fill="var(--text-2)" />
          <text x="126" y={y(t) + 4} fontSize="11" fill="var(--text-3)" className="tabular">
            {t}″
          </text>
        </g>
      ))}
      {hi > 0 && (
        <>
          <line x1="14" x2="96" y1={y(hi)} y2={y(hi)} stroke="var(--ice)" strokeDasharray="3 3" strokeWidth="1" />
          <line x1="14" x2="96" y1={y(lo)} y2={y(lo)} stroke="var(--ice)" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" />
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
