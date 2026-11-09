"use client";
import { useEffect, useRef } from "react";

/** Subtle ambient snowfall. Off under prefers-reduced-motion and when the tab is hidden. */
export function Snowfall() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0;
    let h = 0;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const count = window.innerWidth < 640 ? 45 : 90;
    const flakes = Array.from({ length: count }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.8, s: 0.15 + Math.random() * 0.45, d: Math.random() * Math.PI * 2 }));
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--snowpack") || "#fff";
      for (const f of flakes) {
        f.y += (f.s * 0.6) / h * 2;
        f.d += 0.01;
        if (f.y > 1.02) {
          f.y = -0.02;
          f.x = Math.random();
        }
        ctx.globalAlpha = 0.18 + f.r / 8;
        ctx.beginPath();
        ctx.arc(f.x * w + Math.sin(f.d) * 6, f.y * h, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(tick);
    };
    resize();
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />;
}
