"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Renders children only once the placeholder nears the viewport (keeps heavy widgets off the critical path). */
export function LazyMount({ children, minHeight, rootMargin = "600px" }: { children: ReactNode; minHeight: number; rootMargin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || show) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show, rootMargin]);
  return (
    <div ref={ref} style={{ minHeight }}>
      {show ? children : <div aria-hidden className="neu-inset h-full animate-pulse rounded-[26px]" style={{ height: minHeight }} />}
    </div>
  );
}
