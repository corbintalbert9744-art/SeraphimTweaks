import { useState } from "react";
import { SportResearchBoard } from "@/components/shared/SportResearchBoard";
import { cn } from "@/lib/utils";

export default function TennisPage({ tour: initialTour }: { tour?: "ATP" | "WTA" }) {
  const [tour, setTour] = useState<"ATP" | "WTA">(initialTour ?? "ATP");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <p className="mr-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Tour</p>
        {(["ATP", "WTA"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTour(t)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              tour === t
                ? "bg-white text-black"
                : "bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08] hover:text-neutral-200",
            )}
          >
            {t === "ATP" ? "ATP · Men" : "WTA · Women"}
          </button>
        ))}
      </div>

      <SportResearchBoard
        key={tour}
        league={tour}
        title={`${tour} Research Board`}
        description={
          tour === "ATP"
            ? "ATP (Men) — live PrizePicks/Underdog/Sleeper tennis props (Aces, Games Won, Fantasy Score, …). Green OVER · red UNDER."
            : "WTA (Women) — live PrizePicks/Underdog/Sleeper tennis props (Aces, Games Won, Fantasy Score, …). Green OVER · red UNDER."
        }
        propsPath={`/api/tennis/props?tour=${tour}`}
        queryKey={`tennis-board-${tour}`}
        emptyHint={`${tour} lines aren’t available right now. Check back shortly.`}
      />
    </div>
  );
}
