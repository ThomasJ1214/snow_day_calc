export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="neu-raised-sm grid size-9 place-items-center rounded-xl">
        <svg viewBox="0 0 32 32" aria-hidden className="size-6">
          <rect x="14" y="3" width="5" height="26" rx="2.5" fill="var(--pole)" />
          <rect x="8" y="20" width="16" height="9" rx="4.5" fill="var(--snowpack)" stroke="var(--line-strong)" strokeWidth="0.8" />
          {[8, 12, 16].map((y) => (
            <rect key={y} x="19" y={y} width="4" height="1.6" rx=".8" fill="var(--pole)" />
          ))}
        </svg>
      </span>
      <span className="font-display text-xl font-bold tracking-tight">SnowDay</span>
    </span>
  );
}
