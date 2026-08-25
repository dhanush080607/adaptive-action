import { useEffect, useRef } from "react";
import { animate, createScope, type Scope } from "animejs";
import type { AmbientState } from "./AmbientBackground";

const STATE_CONFIG: Record<
  AmbientState,
  {
    duration: number;
    pulseScale: number;
    ringRotation: number;
    glowOpacity: number;
  }
> = {
  IDLE: {
    duration: 4000,
    pulseScale: 1.04,
    ringRotation: 360,
    glowOpacity: 0.7,
  },
  ANALYZING: {
    duration: 1600,
    pulseScale: 1.1,
    ringRotation: 720,
    glowOpacity: 1,
  },
  UNDERSTANDING: {
    duration: 2800,
    pulseScale: 1.07,
    ringRotation: 360,
    glowOpacity: 0.9,
  },
  PLANNING: {
    duration: 2400,
    pulseScale: 1.06,
    ringRotation: 360,
    glowOpacity: 0.85,
  },
  REPLANNING: {
    duration: 900,
    pulseScale: 1.14,
    ringRotation: 1080,
    glowOpacity: 1,
  },
};

export function AIOrb({
  state = "IDLE",
  size = 120,
}: {
  state?: AmbientState;
  size?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const scope = useRef<Scope | null>(null);

  useEffect(() => {
    if (!root.current) return;

    scope.current = createScope({ root: root.current });

    return () => {
      scope.current?.revert();
    };
  }, []);

  useEffect(() => {
    if (!root.current) return;

    const config = STATE_CONFIG[state];

    const core = root.current.querySelector(
      "[data-ai-core]"
    ) as HTMLElement | null;

    const glow = root.current.querySelector(
      "[data-ai-glow]"
    ) as HTMLElement | null;

    const rings = Array.from(
      root.current.querySelectorAll("[data-ai-ring]")
    ) as HTMLElement[];

    if (!core || !glow || rings.length === 0) return;

    // Stop previous animations before changing state.
    scope.current?.revert();

    scope.current = createScope({ root: root.current }).add(() => {
      // Core breathing animation
      animate(core, {
        scale: [1, config.pulseScale],
        duration: config.duration,
        ease: "inOutSine",
        alternate: true,
        loop: true,
      });

      // Outer glow breathing
      animate(glow, {
        scale: [1, config.pulseScale + 0.05],
        opacity: [0.45, config.glowOpacity],
        duration: config.duration * 1.15,
        ease: "inOutSine",
        alternate: true,
        loop: true,
      });

      // Individual ring motion
      rings.forEach((ring, index) => {
        animate(ring, {
          rotate: index % 2 === 0
            ? config.ringRotation
            : -config.ringRotation,
          scale: [
            1,
            1 + index * 0.035,
            1,
          ],
          duration: config.duration + index * 250,
          ease: "inOutSine",
          loop: true,
        });
      });
    });

    return () => {
      scope.current?.revert();
    };
  }, [state]);

  return (
    <div
      ref={root}
      className="relative shrink-0"
      style={{
        width: size,
        height: size,
      }}
      role="img"
      aria-label={`AI status: ${state.toLowerCase()}`}
    >
      {/* Ambient glow */}
      <div
        data-ai-glow
        className="absolute inset-[-18%] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(0, 220, 255, 0.30) 0%, rgba(70, 140, 255, 0.12) 42%, transparent 72%)",
          filter: "blur(10px)",
          opacity: 0.6,
        }}
      />

      {/* Core */}
      <div
        data-ai-core
        className="absolute inset-[25%] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, rgba(220, 255, 255, 0.98), rgba(80, 220, 255, 0.9) 28%, rgba(50, 120, 255, 0.55) 58%, rgba(20, 40, 100, 0.15) 78%, transparent 100%)",
          boxShadow:
            "0 0 18px rgba(0, 220, 255, 0.8), 0 0 45px rgba(40, 120, 255, 0.45)",
        }}
      />

      {/* Orb rings */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          data-ai-ring
          className="absolute rounded-full border"
          style={{
            inset: `${i * 9}%`,
            borderColor: `rgba(90, 220, 255, ${
              0.42 - i * 0.1
            })`,
            boxShadow:
              i === 0
                ? "0 0 12px rgba(0, 220, 255, 0.22)"
                : "none",
            transformOrigin: "center",
          }}
        />
      ))}

      {/* Inner energy point */}
      <div
        className="absolute left-1/2 top-1/2 h-[8%] w-[8%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "rgba(255,255,255,0.95)",
          boxShadow:
            "0 0 8px rgba(255,255,255,0.9), 0 0 18px rgba(0,220,255,0.8)",
        }}
      />
    </div>
  );
}