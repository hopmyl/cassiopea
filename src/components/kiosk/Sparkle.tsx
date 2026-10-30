"use client";

/** Фирменная четырёхлучевая звезда-блёстка Cassiopea. */
export function Sparkle({
  size = 20,
  className = "",
  color = "#f7ecc9",
  style,
}: {
  size?: number;
  className?: string;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M12 0C12.9 6.6 17.4 11.1 24 12C17.4 12.9 12.9 17.4 12 24C11.1 17.4 6.6 12.9 0 12C6.6 11.1 11.1 6.6 12 0Z"
        fill={color}
      />
    </svg>
  );
}

/** Созвездие Кассиопеи — 5 звёзд буквой W, соединённые линией. */
export function Constellation({ size = 60, className = "" }: { size?: number; className?: string }) {
  const pts = "2,26 12,8 22,24 32,4 42,22";
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 44 30" className={className} aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke="rgba(233,215,167,0.45)"
        strokeWidth="0.7"
      />
      {pts.split(" ").map((p, i) => {
        const [x, y] = p.split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r="1.9" fill="#f7ecc9" />;
      })}
    </svg>
  );
}

/** Разбросанные мерцающие блёстки (декор секций). */
export function Sparkles({ count = 14, className = "" }: { count?: number; className?: string }) {
  const items = Array.from({ length: count }, (_, i) => ({
    left: (i * 71 + 13) % 100,
    top: (i * 37 + 7) % 100,
    size: 6 + ((i * 13) % 12),
    delay: (i % 7) * 0.45,
    dur: 2.6 + ((i * 7) % 20) / 10,
  }));
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {items.map((s, i) => (
        <Sparkle
          key={i}
          size={s.size}
          color={i % 3 === 0 ? "rgba(233,215,167,0.9)" : "rgba(247,236,201,0.65)"}
          className="sparkle-anim absolute"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.dur}s`,
          }}
        />
      ))}
    </div>
  );
}
