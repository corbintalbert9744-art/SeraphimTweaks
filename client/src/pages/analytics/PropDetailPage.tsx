import { Link, useRoute } from "wouter";
import { ArrowLeft, Plus, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { getPropDetail, formatAmericanOdds } from "@/data/propsCatalog";
import "@/data/registerLeagueProps";
import { mockNbaProps } from "@/data/nbaMock";
import { mockNflProps } from "@/data/nflMock";
import { mockTennisProps, tennisToBuilderLeg } from "@/data/tennisMock";
import { mockWnbaProps, wnbaToBuilderLeg } from "@/data/wnbaMock";
import { nbaToBuilderLeg, nflToBuilderLeg } from "@/lib/builderMappers";
import { cn } from "@/lib/utils";

function MovementChart({
  points,
}: {
  points: Array<{ label: string; line: number; odds: number }>;
}) {
  const values = points.map((p) => p.line);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 320;
  const height = 120;
  const coords = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - 20 - ((v - min) / range) * (height - 40);
    return { x, y };
  });
  const line = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full">
        <polyline
          fill="none"
          stroke="rgb(250, 204, 21)"
          strokeWidth="2.5"
          points={line}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <circle key={points[i].label} cx={c.x} cy={c.y} r="4" fill="#0a0a0a" stroke="rgb(250, 204, 21)" strokeWidth="2" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
        {points.map((p) => (
          <span key={p.label}>
            {p.label} · {p.line}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function PropDetailPage() {
  const [, params] = useRoute("/prop/:id");
  const propId = params?.id ?? "";
  const prop = getPropDetail(propId);
  const { addLeg, hasLeg } = useParlayDraft();

  if (!prop) {
    return (
      <div className="card-3d rounded-2xl border border-[#1a1a1a] p-10 text-center">
        <h1 className="text-xl font-semibold text-white">Prop not found</h1>
        <p className="mt-2 text-sm text-neutral-400">No mock detail for “{propId}”.</p>
        <Link href="/nba" className="mt-6 inline-block text-sm text-yellow-400 hover:underline">
          Back to boards
        </Link>
      </div>
    );
  }

  const added = hasLeg(prop.id);

  function handleAdd() {
    const nba = mockNbaProps.find((p) => p.id === prop!.id);
    if (nba) {
      addLeg(nbaToBuilderLeg(nba));
      return;
    }
    const nfl = mockNflProps.find((p) => p.id === prop!.id);
    if (nfl) {
      addLeg(nflToBuilderLeg(nfl));
      return;
    }
    const tennis = mockTennisProps.find((p) => p.id === prop!.id);
    if (tennis) {
      addLeg(tennisToBuilderLeg(tennis));
      return;
    }
    const wnba = mockWnbaProps.find((p) => p.id === prop!.id);
    if (wnba) addLeg(wnbaToBuilderLeg(wnba));
  }

  return (
    <div>
      <Link
        href={
          prop.league === "NFL"
            ? "/nfl"
            : prop.league === "WNBA"
              ? "/wnba"
              : prop.league === "ATP"
                ? "/atp"
                : prop.league === "WTA"
                  ? "/wta"
                  : "/nba"
        }
        className="mb-4 inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-yellow-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {prop.league} board
      </Link>

      <PageHeader
        eyebrow="Prop detail"
        title={`${prop.player} · ${prop.market}`}
        description={`${prop.side} ${prop.line} · ${prop.team} vs ${prop.opponent} · ${prop.tipTime}`}
        actions={
          <button
            type="button"
            disabled={added}
            onClick={handleAdd}
            className={cn(
              "btn-3d inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold",
              added
                ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                : "bg-gradient-to-b from-yellow-400 to-amber-500 text-black",
            )}
          >
            {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {added ? "In Builder" : "Add to Builder"}
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Odds" value={formatAmericanOdds(prop.americanOdds)} />
        <Metric label="No-Vig" value={`${(prop.noVigProb * 100).toFixed(1)}%`} />
        <Metric label="EV" value={`+${prop.evPercent.toFixed(1)}%`} accent="emerald" />
        <Metric label="Confidence" value={`${prop.confidence}`} accent="gold" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="card-3d rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/[0.07] to-transparent p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-500/90">
                  Why this is rated highly
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">{prop.why}</h2>
              </div>
              <ResearchScoreBadge score={prop.confidence} />
            </div>
            <ul className="mt-5 space-y-2">
              {prop.checks.map((check) => (
                <li
                  key={check.code}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
                    check.status === "pass" && "border-emerald-500/20 bg-black/20 text-emerald-200",
                    check.status === "warn" && "border-amber-500/20 bg-black/20 text-amber-200",
                    check.status === "fail" && "border-red-500/20 bg-black/20 text-red-200",
                    check.status === "unknown" && "border-neutral-700 bg-black/20 text-neutral-400",
                  )}
                >
                  <span className="w-4 shrink-0 text-center">
                    {check.status === "pass" ? "✓" : check.status === "fail" ? "✗" : "~"}
                  </span>
                  {check.label}
                </li>
              ))}
            </ul>
          </section>

          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">Hit rates at this line</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Hit label="L5" value={prop.l5} />
              <Hit label="L10" value={prop.l10} />
              <Hit label="L20" value={prop.l20} />
              <Hit label="Season" value={prop.season} />
            </div>
          </section>

          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">Line movement</h2>
            <p className="mt-1 text-xs text-neutral-500">Open → current (mock series)</p>
            <div className="mt-4">
              <MovementChart points={prop.movement} />
            </div>
          </section>

          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">Analysis notes</h2>
            <ul className="mt-3 space-y-2">
              {prop.analysis.map((line) => (
                <li key={line} className="text-sm leading-relaxed text-neutral-400">
                  <span className="mr-2 text-yellow-500">•</span>
                  {line}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Data Quality</h2>
              <span className="text-2xl font-semibold tabular-nums text-yellow-400">{prop.dqs}</span>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Trust in inputs (freshness, injuries, book agreement). Separate from Research Score.
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-600 to-yellow-400"
                style={{ width: `${prop.dqs}%` }}
              />
            </div>
          </section>

          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">Books</h2>
            <ul className="mt-3 space-y-2">
              {prop.books.map((b) => (
                <li
                  key={b.book}
                  className="flex items-center justify-between rounded-lg border border-[#1a1a1a] bg-black/20 px-3 py-2 text-sm"
                >
                  <span className="text-neutral-400">{b.book}</span>
                  <span className="tabular-nums text-neutral-200">
                    {b.line} · {formatAmericanOdds(b.odds)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">Player</h2>
            <div className="mt-3 flex items-center gap-2">
              <LeagueBadge league={prop.league} />
              <Link href={`/player/${prop.playerId}`} className="text-sm font-medium text-yellow-400 hover:underline">
                {prop.player}
              </Link>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              {prop.team} vs {prop.opponent} · {prop.position}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "gold";
}) {
  return (
    <div className="card-3d rounded-2xl border border-[#1a1a1a] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums",
          accent === "emerald" && "text-emerald-300",
          accent === "gold" && "text-yellow-400",
          !accent && "text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Hit({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-black/25 px-3 py-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-100">{value}</p>
    </div>
  );
}
