import { useEffect, useRef } from "react";

export type AmbientState = "IDLE" | "ANALYZING" | "UNDERSTANDING" | "PLANNING" | "REPLANNING";

type Props = {
  state?: AmbientState;
  density?: "full" | "subtle";
};

const SPEED: Record<AmbientState, number> = {
  IDLE: 0.16,
  ANALYZING: 0.45,
  UNDERSTANDING: 0.32,
  PLANNING: 0.28,
  REPLANNING: 0.6,
};

/**
 * Lightweight canvas particle/constellation field. Purely decorative:
 * fixed, pointer-events none, behind all content, and disabled entirely when
 * the user prefers reduced motion or canvas is unavailable.
 */
export function AmbientBackground({ state = "IDLE", density = "full" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<AmbientState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = () => canvas.clientWidth;
    const height = () => canvas.clientHeight;
    const isMobile = window.innerWidth < 768;
    const base = density === "subtle" ? 26 : 52;
    const count = isMobile ? Math.round(base * 0.45) : window.innerWidth < 1280 ? Math.round(base * 0.7) : base;
    const linkDistance = isMobile ? 90 : 140;
    const alpha = density === "subtle" ? 0.35 : 0.7;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width() * dpr));
      canvas.height = Math.max(1, Math.floor(height() * dpr));
    };
    resize();

    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * width(),
      y: Math.random() * height(),
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2,
      r: Math.random() * 1.6 + 0.6,
    }));

    let raf = 0;
    let running = true;
    const onVisibility = () => {
      running = !document.hidden;
      if (running) raf = requestAnimationFrame(frame);
    };

    const frame = () => {
      if (!running) return;
      const speed = SPEED[stateRef.current];
      const w = width();
      const h = height();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx * speed;
        p.y += p.vy * speed;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      const connecting = stateRef.current !== "IDLE";
      ctx.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]!;
          const b = particles[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < linkDistance) {
            const strength = (1 - dist / linkDistance) * (connecting ? 0.32 : 0.18) * alpha;
            ctx.strokeStyle = `rgba(96, 186, 255, ${strength})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.fillStyle = `rgba(150, 224, 255, ${0.55 * alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ contain: "strict" }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 15% 0%, oklch(0.72 0.155 230 / 0.16), transparent 65%), radial-gradient(70% 60% at 90% 10%, oklch(0.8 0.14 195 / 0.1), transparent 60%)",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
