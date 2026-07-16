import { PICKEM_APPS, type PickemAppId } from "@/data/pickemApps";
import { usePickemApp } from "@/context/PickemAppContext";
import { cn } from "@/lib/utils";

/** Full-screen gate — choose a pick'em app before any board lines load. */
export function PickemAppGate({
  title = "Which pick'em app are you using?",
  description = "We'll only show players, stats, and lines currently available on that platform — nothing from other apps.",
}: {
  title?: string;
  description?: string;
}) {
  const { setAppId } = usePickemApp();

  return (
    <section
      data-feature="pickem-app-gate"
      className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#121212] via-[#0c0c0c] to-[#16120a] px-6 py-12 sm:px-10 sm:py-16"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 20% 0%, rgba(234,179,8,0.12), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 100%, rgba(139,92,246,0.1), transparent 50%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400/90">
          Pick&apos;em platform
        </p>
        <h1 className="mt-3 font-semibold tracking-tight text-white text-3xl sm:text-4xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">{description}</p>
      </div>

      <div className="relative mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-2">
        {PICKEM_APPS.map((app) => (
          <button
            key={app.id}
            type="button"
            onClick={() => setAppId(app.id)}
            className={cn(
              "group flex items-start gap-4 rounded-2xl border border-white/[0.08] bg-black/40 px-5 py-5 text-left transition",
              "hover:border-white/20 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400",
            )}
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-black"
              style={{ backgroundColor: app.accent }}
            >
              {app.mark}
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold text-white group-hover:text-amber-300">
                {app.name}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-neutral-500">{app.description}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Compact switcher shown after an app is selected. */
export function PickemAppSwitcher({ className }: { className?: string }) {
  const { appId, setAppId, clearApp, app } = usePickemApp();

  return (
    <div
      data-feature="pickem-app-switcher"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">App</span>
      <div className="flex flex-wrap gap-1.5">
        {PICKEM_APPS.map((opt) => {
          const active = appId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAppId(opt.id as PickemAppId)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "border-transparent text-black"
                  : "border-white/[0.08] text-neutral-400 hover:border-white/20 hover:text-neutral-200",
              )}
              style={active ? { backgroundColor: opt.accent } : undefined}
            >
              {opt.shortName}
            </button>
          );
        })}
      </div>
      {app && (
        <button
          type="button"
          onClick={clearApp}
          className="ml-1 text-[11px] text-neutral-600 underline-offset-2 hover:text-neutral-400 hover:underline"
        >
          Change
        </button>
      )}
    </div>
  );
}
