"use client";
import { useEffect, useRef } from "react";

/**
 * Snowfall confined to its parent (position the parent `relative overflow-hidden`).
 * `intensity` (0–1) comes from the real forecast, so heavy snow on the way means heavier snow
 * on screen and a dry forecast leaves only a few drifting flakes. Three depth layers (far, mid,
 * near) share one wind; near flakes are larger and softly out of focus. In the light theme each
 * flake gets a faint cool shadow so it reads against the snow-coloured surface. Paused when
 * off-screen or the tab is hidden; disabled for reduced motion.
 */
export function Snowfall({ intensity = 0.1, className = "" }: { intensity?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let dark = document.documentElement.dataset.theme === "dark";
    const level = Math.max(0.06, Math.min(1, intensity));

    const sprite = (r: number, blur: number) => {
      const size = Math.ceil((r + blur) * 2 + 4) * dpr;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const g = c.getContext("2d")!;
      const mid = size / 2;
      if (!dark) {
        const s = g.createRadialGradient(mid + 0.8 * dpr, mid + 0.9 * dpr, 0, mid + 0.8 * dpr, mid + 0.9 * dpr, (r + blur) * dpr);
        s.addColorStop(0, "rgba(120,140,172,0.45)");
        s.addColorStop(1, "rgba(120,140,172,0)");
        g.fillStyle = s;
        g.fillRect(0, 0, size, size);
      }
      const f = g.createRadialGradient(mid, mid, 0, mid, mid, (r + blur) * dpr);
      const core = dark ? "238,245,255" : "255,255,255";
      f.addColorStop(0, `rgba(${core},1)`);
      f.addColorStop(r / (r + blur), `rgba(${core},0.85)`);
      f.addColorStop(1, `rgba(${core},0)`);
      g.fillStyle = f;
      g.fillRect(0, 0, size, size);
      return c;
    };
    const layers = [
      { n: 46, r: [0.7, 1.2], speed: [10, 16], alpha: 0.55, blur: 0.6 },
      { n: 26, r: [1.4, 2.2], speed: [20, 30], alpha: 0.8, blur: 1 },
      { n: 8, r: [2.8, 4.2], speed: [36, 50], alpha: 0.55, blur: 3.5 },
    ];
    type Flake = { x: number; y: number; vy: number; phase: number; img: HTMLCanvasElement; a: number; size: number };
    let w = 0;
    let h = 0;
    let flakes: Flake[] = [];
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const build = () => {
      const area = Math.max(0.25, (w * h) / 180_000);
      flakes = layers.flatMap((l) =>
        Array.from({ length: Math.round(l.n * level * area) }, () => {
          const r = rand(l.r[0], l.r[1]);
          const img = sprite(r, l.blur);
          return { x: Math.random() * w, y: Math.random() * h, vy: rand(l.speed[0], l.speed[1]), phase: Math.random() * Math.PI * 2, img, a: l.alpha * rand(0.7, 1), size: img.width / dpr };
        }),
      );
    };
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };

    let raf = 0;
    let last = performance.now();
    let visible = true;
    const wind = 0.22;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const f of flakes) {
        f.phase += dt * 0.8;
        f.y += f.vy * dt;
        f.x += (f.vy * wind + Math.sin(f.phase) * 6) * dt;
        if (f.y > h + f.size) {
          f.y = -f.size;
          f.x = Math.random() * (w + 40) - 40;
        }
        if (f.x > w + f.size) f.x = -f.size;
        ctx.globalAlpha = f.a;
        ctx.drawImage(f.img, f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      if (visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      start();
    });
    io.observe(canvas);
    resize();
    start();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const mo = new MutationObserver(() => {
      dark = document.documentElement.dataset.theme === "dark";
      build();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    document.addEventListener("visibilitychange", start);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", start);
    };
  }, [intensity]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}

/** Maps a forecast's most-likely 24 h snowfall (cm) to on-screen snow intensity. */
export const snowIntensity = (likely24Cm: number) => Math.min(1, 0.08 + likely24Cm / 15);
