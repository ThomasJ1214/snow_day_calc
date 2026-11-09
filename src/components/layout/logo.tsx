export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" aria-hidden className="size-7">
        <defs>
          <linearGradient id="sd-g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="var(--ice)" />
            <stop offset="1" stopColor="var(--violet)" />
          </linearGradient>
        </defs>
        <rect x="13" y="3" width="6" height="26" rx="3" fill="url(#sd-g)" opacity=".9" />
        <rect x="9" y="20" width="14" height="9" rx="4.5" fill="var(--snowpack)" opacity=".95" />
        {[8, 12, 16].map((y) => (
          <rect key={y} x="19" y={y} width="4" height="1.6" rx=".8" fill="var(--ice)" />
        ))}
      </svg>
      <span className="font-display text-xl font-bold tracking-tight">SnowDay</span>
    </span>
  );
}
