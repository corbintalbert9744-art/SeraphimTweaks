import { cn } from "@/lib/utils";

interface ChartPoint {
  label: string;
  value: number;
}

export function PlaceholderChart({
  title,
  subtitle,
  data,
  variant = "area",
}: {
  title: string;
  subtitle?: string;
  data: ChartPoint[];
  variant?: "area" | "bars";
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
      </div>

      {variant === "bars" ? (
        <div className="flex h-40 items-end gap-3">
          {data.map((point) => (
            <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
              <div className="relative flex h-32 w-full items-end justify-center">
                <div
                  className="w-full max-w-[36px] rounded-t-md bg-gradient-to-t from-amber-700/40 via-yellow-500/50 to-yellow-300/80 transition-all duration-500"
                  style={{ height: `${(point.value / max) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-neutral-500">{point.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative h-40">
          <svg viewBox="0 0 320 140" className="h-full w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="evFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(250, 204, 21)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="rgb(250, 204, 21)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {(() => {
              const coords = data.map((d, i) => {
                const x = (i / (data.length - 1)) * 320;
                const y = 120 - (d.value / max) * 100;
                return { x, y, label: d.label };
              });
              const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
              const area = `M0,140 L${coords.map((c) => `${c.x},${c.y}`).join(" L")} L320,140 Z`;
              return (
                <>
                  <path d={area} fill="url(#evFill)" />
                  <polyline
                    fill="none"
                    stroke="rgb(250, 204, 21)"
                    strokeWidth="2.5"
                    points={line}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {coords.map((c) => (
                    <circle key={c.label} cx={c.x} cy={c.y} r="3.5" fill="#0a0a0a" stroke="rgb(250, 204, 21)" strokeWidth="2" />
                  ))}
                </>
              );
            })()}
          </svg>
          <div className="mt-1 flex justify-between px-1">
            {data.map((d) => (
              <span key={d.label} className={cn("text-[10px] text-neutral-500")}>
                {d.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
