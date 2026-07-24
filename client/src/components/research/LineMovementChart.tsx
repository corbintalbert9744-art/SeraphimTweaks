import { cn } from "@/lib/utils";

export function LineMovementChart({
  points,
  className,
}: {
  points: Array<{ label: string; line: number; odds?: number }>;
  className?: string;
}) {
  if (!points.length) {
    return <p className="text-sm text-neutral-500">No line ticks yet.</p>;
  }
  const values = points.map((p) => p.line);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 360;
  const height = 128;
  const coords = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * width;
    const y = height - 24 - ((v - min) / range) * (height - 48);
    return { x, y };
  });
  const poly = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div className={cn(className)} data-feature="line-movement">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full">
        <polyline
          fill="none"
          stroke="rgb(234, 179, 8)"
          strokeWidth="2.25"
          points={poly}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <circle
            key={points[i].label}
            cx={c.x}
            cy={c.y}
            r="3.5"
            fill="#0a0a0a"
            stroke="rgb(234, 179, 8)"
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-neutral-500">
        {points.map((p) => (
          <span key={p.label} className="tabular-nums">
            {p.label} · {p.line}
          </span>
        ))}
      </div>
    </div>
  );
}
