import { Link } from "wouter";
import { pricingPlans } from "@/lib/products";

const CheckIcon = () => (
  <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const clickableStyles = "transition-all duration-300 ease-out hover:scale-[1.02] active:scale-95";

export default function Pricing() {
  return (
    <div className="min-h-screen text-white relative">
      {/* Golden ambient sparkles */}
      <div className="gold-sparkles" />
      {/* Nav */}
      <nav className="fixed top-0 w-full bg-black/70 backdrop-blur-xl border-b border-[#1a1a1a]/50 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <a className="flex items-center gap-3 group cursor-pointer transition-all duration-300">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_10px_4px_rgba(234,179,8,0.75)] block flex-shrink-0 group-hover:shadow-[0_0_14px_6px_rgba(234,179,8,0.9)] transition-all" />
              <span className="text-sm font-bold text-white tracking-tight">Seraphim Tweaks</span>
            </a>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="/"><a className={`text-sm text-neutral-400 hover:text-white ${clickableStyles}`}>Home</a></Link>
            <span className="text-sm text-white">Products</span>
            <Link href="/reviews"><a className={`text-sm text-neutral-400 hover:text-white ${clickableStyles}`}>Reviews</a></Link>
            <Link href="/terms"><a className={`text-sm text-neutral-400 hover:text-white ${clickableStyles}`}>Terms</a></Link>
            <button onClick={() => window.open('https://discord.gg/yP4uBqNyrP', '_blank')} className={`text-sm text-neutral-400 hover:text-white flex items-center gap-1.5 ${clickableStyles}`}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
              Discord
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/pricing">
              <a className={`btn-3d text-sm font-medium bg-white text-slate-900 px-4 py-2 rounded-lg cursor-pointer inline-block ${clickableStyles}`}>
                🛒 Buy Now
              </a>
            </Link>
          </div>
        </div>
      </nav>

      {/* Pricing Section */}
      <section className="pt-32 pb-24 px-6 min-h-screen relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '0ms' }}>
              <span>All Products</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-4 text-white tracking-tight animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '80ms' }}>Simple, transparent pricing</h1>
            <p className="text-lg text-neutral-400 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '160ms' }}>Pick the tweak that fits your setup. One-time payment, instant delivery.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '240ms' }}>
            {pricingPlans.map((plan, i) => (
              <Link key={i} href={`/product/${plan.slug}`}>
                <a
                  className={`relative p-8 rounded-2xl border block h-full ${clickableStyles} ${
                    plan.popular
                      ? 'card-3d card-3d-popular border-yellow-500/50'
                      : 'card-3d border-[#1a1a1a]'
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-500 text-black rounded-full text-xs font-bold uppercase tracking-wider shadow-lg shadow-yellow-500/20">
                      Most Popular
                    </span>
                  )}
                  <div className="mb-4">
                    <h3 className="text-2xl font-bold mb-1 text-white group-hover:text-yellow-400 transition-colors">{plan.name}</h3>
                    <p className="text-sm text-neutral-400">{plan.desc}</p>
                  </div>
                  <div className="mb-6">
                    <span className="font-bold text-white text-4xl">${plan.price}</span>
                    <span className="text-neutral-500 ml-1 font-medium">{plan.period}</span>
                  </div>
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-3 text-sm text-neutral-300">
                        <CheckIcon />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div
                    className={`btn-3d w-full inline-flex justify-center items-center py-4 rounded-xl font-bold transition-all ${
                      plan.popular
                        ? 'bg-yellow-500 text-black'
                        : 'bg-[#141414] border border-neutral-800 text-white'
                    }`}
                  >
                    {plan.cta}
                  </div>
                </a>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[#1a1a1a]/50 bg-black/60 backdrop-blur-sm relative">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-12 text-sm text-neutral-400">
            <a href="#" className={`hover:text-white px-2 py-1 rounded ${clickableStyles}`}>Privacy</a>
            <a href="#" className={`hover:text-white px-2 py-1 rounded ${clickableStyles}`}>Terms</a>
            <a href="https://payhip.com/SeraphimTweaks/contact" target="_blank" rel="noopener noreferrer" className={`hover:text-white px-2 py-1 rounded ${clickableStyles}`}>Contact</a>
          </div>
          <p className="text-sm text-neutral-500">© 2026 Seraphim. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
