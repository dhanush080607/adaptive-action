import type { AmbientState } from "./AmbientBackground";

const RING_SPEED: Record<AmbientState, string> = {
  IDLE: "18s",
  ANALYZING: "5s",
  UNDERSTANDING: "8s",
  PLANNING: "10s",
  REPLANNING: "3.5s",
};

/** Reusable AI activity visualization. State always reflects real app state. */
export function AIOrb({ state = "IDLE", size = 120 }: { state?: AmbientState; size?: number }) {
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`AI status: ${state.toLowerCase()}`}
    >
      <div
        className="absolute inset-0 rounded-full pulse-soft"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, oklch(0.9 0.09 200 / 0.9), oklch(0.62 0.17 240 / 0.35) 55%, transparent 72%)",
          filter: "blur(1px)",
        }}
      />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute rounded-full border"
          style={{
            inset: `${i * 9}%`,
            borderColor: `oklch(0.8 0.14 200 / ${0.4 - i * 0.1})`,
            transform: `rotate(${i * 32}deg)`,
            animation: `spin ${RING_SPEED[state]} linear infinite ${i % 2 ? "reverse" : ""}`,
          }}
        />
      ))}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
