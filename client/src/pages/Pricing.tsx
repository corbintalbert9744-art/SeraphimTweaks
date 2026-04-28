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
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="fixed top-0 w-full bg-black/80 backdrop-blur-xl border-b border-[#1a1a1a]/50 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between relative">
          <Link href="/">
            <a className="flex items-center gap-4 group cursor-pointer transition-all duration-300">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-[#2a2a2a] p-2.5 flex items-center justify-center shadow-2xl group-hover:border-[#D4AF37]/30 transition-all">
                <img src="/logo.png" alt="Seraphim Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-white leading-tight tracking-tight">Seraphim</span>
                <span className="text-[11px] font-bold tracking-[0.15em] text-[#D4AF37] uppercase leading-none mt-0.5">Gaming Tweaks</span>
              </div>
            </a>
          </Link>

          <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-8">
            <Link href="/">
              <a className={`text-sm text-neutral-400 hover:text-white px-2 py-1 rounded-md ${clickableStyles}`}>Home</a>
            </Link>
            <Link href="/pricing">
              <a className={`text-sm text-white px-2 py-1 rounded-md ${clickableStyles}`}>Pricing</a>
            </Link>
            <button
              onClick={() => window.open('https://discord.gg/yP4uBqNyrP', '_blank')}
              className={`text-sm text-neutral-400 hover:text-white px-2 py-1 rounded-md ${clickableStyles}`}
            >
              Discord
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/pricing">
              <a className={`text-sm font-medium bg-white text-slate-900 px-4 py-2 rounded-lg cursor-pointer inline-block ${clickableStyles}`}>
                🛒 Buy Now
              </a>
            </Link>
          </div>
        </div>
      </nav>

      {/* Pricing Section */}
      <section className="pt-32 pb-24 px-6 bg-[#0b0b0b] min-h-screen">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm mb-6">
              <span>All Products</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-4 text-white tracking-tight">Simple, transparent pricing</h1>
            <p className="text-lg text-neutral-400">Pick the tweak that fits your setup. One-time payment, instant delivery.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {pricingPlans.map((plan, i) => (
              <Link key={i} href={`/product/${plan.slug}`}>
                <a
                  className={`relative p-8 rounded-2xl border block h-full ${clickableStyles} ${
                    plan.popular
                      ? 'bg-gradient-to-b from-yellow-500/5 to-neutral-950 border-yellow-500/50 shadow-2xl shadow-yellow-500/10'
                      : 'bg-[#0f0f0f] border-[#1a1a1a]'
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
                    className={`w-full inline-flex justify-center items-center py-4 rounded-xl font-bold transition-all ${
                      plan.popular
                        ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
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
      <footer className="py-12 px-6 border-t border-[#1a1a1a]/50 bg-[#0a0a0a]">
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
