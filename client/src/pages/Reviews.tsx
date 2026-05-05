import { Link } from "wouter";

const clickableStyles = "transition-all duration-300 ease-out hover:scale-[1.02] active:scale-95";

const DiscordIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
  </svg>
);

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg className={`w-4 h-4 ${filled ? 'text-yellow-400' : 'text-neutral-700'}`} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);

const VerifiedBadge = () => (
  <span className="flex items-center gap-1 text-xs text-yellow-400 border border-yellow-500/30 rounded px-2 py-0.5 bg-yellow-500/10">
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
    VERIFIED
  </span>
);

const reviews = [
  {
    quote: "ngl i was skeptical at first but this actually cracked. went from 140 fps with drops to a clean 240 locked. ain't no way tf",
    author: "Anonymous", product: "Zero Delay Tweaks", time: "2d ago", stars: 5, verified: true,
  },
  {
    quote: "bloom reducer is disgusting fr. flicks feel buttery, shots actually register now. paid for itself after one tourney lowkey",
    author: "Anonymous", product: "Bloom Reducer", time: "5d ago", stars: 5, verified: true,
  },
  {
    quote: "macro hits different bro. double edits on controller feel like im on kbm fr. delay adjustment is clutch for diff scenarios",
    author: "Anonymous", product: "Seraphim Macro", time: "6d ago", stars: 5, verified: true,
  },
  {
    quote: "bro my xbox was cooked before this. running cod no stutters now idk what they did but it works. worth every dollar",
    author: "Anonymous", product: "Xbox Tweaks", time: "2w ago", stars: 5, verified: true,
  },
  {
    quote: "tried other macros and they all flagged lookin sus. this one clean, undetectable, and consistent af. runs like butter on mnk too",
    author: "Anonymous", product: "Seraphim Macro", time: "2w ago", stars: 5, verified: true,
  },
  {
    quote: "been using tweaks for 3 months no issues. updates drop every couple weeks too which is nuts. set n forget type beat",
    author: "Anonymous", product: "Zero Delay Tweaks", time: "3m ago", stars: 5, verified: true,
  },
  {
    quote: "Went from 144 FPS to 240 stable after getting FPS tweaks. genuinely insane difference in competitive lobbies",
    author: "Bray", product: "FPS Boost", time: "1m ago", stars: 5, verified: true,
  },
  {
    quote: "Zero Delay makes it feel like I'm on 0 ping. inputs register so clean now, night and day difference fr",
    author: "Zyren", product: "Zero Delay Tweaks", time: "1m ago", stars: 5, verified: true,
  },
  {
    quote: "Tweaks got me moving. finally hitting my shots consistently, the bloom fix alone was worth every cent",
    author: "ManMan", product: "Bloom Reducer", time: "2m ago", stars: 5, verified: true,
  },
];

export default function Reviews() {
  return (
    <div className="min-h-screen text-white relative">
      <div className="gold-sparkles" />

      {/* Nav */}
      <nav className="fixed top-0 w-full bg-black/70 backdrop-blur-xl border-b border-[#1a1a1a]/50 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <a className="flex items-center gap-3 group cursor-pointer transition-all duration-300">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_10px_4px_rgba(234,179,8,0.75)] block flex-shrink-0 group-hover:shadow-[0_0_14px_6px_rgba(234,179,8,0.9)] transition-all" />
              <span className="text-xl font-bold text-white tracking-tight">Seraphim Tweaks</span>
            </a>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="/"><a className={`text-sm text-neutral-400 hover:text-white ${clickableStyles}`}>Home</a></Link>
            <Link href="/pricing"><a className={`text-sm text-neutral-400 hover:text-white ${clickableStyles}`}>Products</a></Link>
            <span className="text-sm text-white">Reviews</span>
            <Link href="/terms"><a className={`text-sm text-neutral-400 hover:text-white ${clickableStyles}`}>Terms</a></Link>
            <button onClick={() => window.open('https://discord.gg/yP4uBqNyrP', '_blank')} className={`text-sm text-neutral-400 hover:text-white flex items-center gap-1.5 ${clickableStyles}`}>
              <DiscordIcon />Discord
            </button>
          </div>

          <Link href="/pricing">
            <a className={`text-sm font-medium bg-white text-slate-900 px-4 py-2 rounded-lg cursor-pointer inline-block ${clickableStyles}`}>
              Buy Now →
            </a>
          </Link>
        </div>
      </nav>

      {/* Page Content */}
      <div className="pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm mb-6">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Real customers, real results
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">What people are saying</h1>
            <p className="text-neutral-400 max-w-xl mx-auto">Hundreds of players trust Seraphim to level up their performance.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {reviews.map((r, i) => (
              <div
                key={i}
                className="card-3d p-6 rounded-2xl border border-[#1a1a1a]/80 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <StarIcon key={s} filled={s < r.stars} />
                    ))}
                  </div>
                  {r.verified && <VerifiedBadge />}
                </div>

                <p className="text-neutral-300 text-sm leading-relaxed flex-1">"{r.quote}"</p>

                <div className="flex items-center justify-between pt-3 border-t border-[#1a1a1a]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center text-xs font-bold text-black">
                      {r.author[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{r.author}</p>
                      <p className="text-xs text-neutral-500">{r.product}</p>
                    </div>
                  </div>
                  <span className="text-xs text-neutral-600">{r.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
