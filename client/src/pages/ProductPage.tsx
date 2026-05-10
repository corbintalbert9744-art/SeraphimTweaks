import React from 'react';
import { useRoute, Link } from "wouter";
import { products } from "@/lib/products";
import { ArrowLeft, Check, Cpu, Shield, Zap, ShoppingCart } from "lucide-react";

export default function ProductPage() {
  const [match, params] = useRoute("/product/:id");
  const productId = params?.id;
  const product = productId ? products[productId] : null;

  if (!product) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center flex-col gap-4">
        <h1 className="text-4xl font-bold text-yellow-500">Product Not Found</h1>
        <Link href="/">
          <a className="text-neutral-400 hover:text-white transition-colors flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </a>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white font-sans selection:bg-yellow-500/30 relative">
      {/* Golden ambient sparkles */}
      <div className="gold-sparkles" />
      {/* Subtle grid */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-black/70 backdrop-blur-xl border-b border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/">
            <a className="flex items-center gap-3 group cursor-pointer transition-all duration-300">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_10px_4px_rgba(234,179,8,0.75)] block flex-shrink-0 group-hover:shadow-[0_0_14px_6px_rgba(234,179,8,0.9)] transition-all" />
              <span className="text-sm font-bold text-white tracking-tight">Seraphim Tweaks</span>
            </a>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/"><a className="text-sm text-neutral-400 hover:text-white transition-colors">Home</a></Link>
            <Link href="/pricing"><a className="text-sm text-neutral-400 hover:text-white transition-colors">Products</a></Link>
            <Link href="/reviews"><a className="text-sm text-neutral-400 hover:text-white transition-colors">Reviews</a></Link>
            <Link href="/terms"><a className="text-sm text-neutral-400 hover:text-white transition-colors">Terms</a></Link>
            <button onClick={() => window.open('https://discord.gg/yP4uBqNyrP', '_blank')} className="text-sm text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
              Discord
            </button>
          </div>
          <div className="flex items-center gap-3">
             <Link href="/pricing">
               <a className="btn-3d text-sm font-medium bg-white text-slate-900 px-4 py-2 rounded-lg transition-colors hover:bg-neutral-200 inline-block cursor-pointer">
                 Purchase Now →
               </a>
             </Link>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          
          {/* Left Column: Product Info */}
          <div className="space-y-8 animate-in slide-in-from-left duration-700 fade-in">
            <div>
              {product.badge && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold uppercase tracking-wider mb-6 shadow-[0_0_15px_-3px_rgba(234,179,8,0.3)]">
                  <Zap className="w-3 h-3" />
                  {product.badge}
                </div>
              )}
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-2 text-white">
                {product.name}
              </h1>
              <p className="text-xl md:text-2xl text-yellow-500 font-medium tracking-wide">
                {product.subtitle}
              </p>
            </div>

            <p className="text-lg text-neutral-400 leading-relaxed border-l-2 border-yellow-500/30 pl-6">
              {product.description}
            </p>

            <div className="flex items-baseline gap-4">
              <span className="text-5xl font-bold text-white tracking-tight">${product.price}</span>
              <span className="text-lg text-neutral-500 uppercase font-medium">One-time payment</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button 
                onClick={() => {
                  const destinations: Record<string, string> = {
                    "fps-boost": "https://payhip.com/buy?s=1&cart_links%5B%5D=oRNea&qty%5BoRNea%5D=1",
                    "zero-delay": "https://payhip.com/buy?s=1&cart_links%5B%5D=kjZgR&qty%5BkjZgR%5D=1",
                    "bloom-reducer": "https://payhip.com/buy?s=1&cart_links%5B%5D=uXWr4&qty%5BuXWr4%5D=1",
                    "xbox-zero-delay": "https://payhip.com/buy?s=1&cart_links%5B%5D=JYnlv&qty%5BJYnlv%5D=1",
                    "keyboard-macro": "https://payhip.com/buy?s=1&cart_links%5B%5D=Ff4v6&qty%5BFf4v6%5D=1"
                  };
                  
                  if (product.id && destinations[product.id]) {
                    window.location.href = destinations[product.id];
                  } else {
                    console.warn("Missing checkout destination for product:", product.id);
                  }
                }}
                className="flex-1 px-8 py-5 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-xl font-bold text-lg text-black hover:opacity-90 transition-all shadow-[0_0_20px_-5px_rgba(234,179,8,0.5)] hover:shadow-[0_0_30px_-5px_rgba(234,179,8,0.6)] hover:translate-y-[-2px] active:translate-y-[0px] flex items-center justify-center gap-3 cursor-pointer"
              >
                <ShoppingCart className="w-5 h-5" />
                Buy Now
              </button>
              <button 
                className="px-8 py-5 bg-[#1a1a1a] border border-neutral-800 rounded-xl font-semibold text-lg hover:bg-[#222] hover:border-neutral-700 transition-colors text-white"
                onClick={() => document.getElementById('requirements')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Requirements
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-8 border-t border-[#1a1a1a]">
               <div className="flex items-center gap-3 text-sm text-neutral-400">
                  <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-green-400">
                    <Shield className="w-4 h-4" />
                  </div>
                  <span>100% Safe & Reversible</span>
               </div>
               <div className="flex items-center gap-3 text-sm text-neutral-400">
                  <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-blue-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <span>Instant Delivery</span>
               </div>
            </div>
          </div>

          {/* Right Column: Visuals & Features */}
          <div className="space-y-8 animate-in slide-in-from-right duration-700 fade-in delay-100">
            {/* Screenshot */}
            <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] relative overflow-hidden group shadow-2xl">
              {product.id === 'fps-boost' ? (
                <div className="space-y-3 p-3">
                  <img
                    src="/fps-boost-1.png"
                    alt="FPS Boost Dashboard"
                    className="w-full rounded-xl object-cover border border-[#2a2a2a]"
                  />
                  <img
                    src="/fps-boost-2.png"
                    alt="FPS Boost Optimizations"
                    className="w-full rounded-xl object-cover border border-[#2a2a2a]"
                  />
                </div>
              ) : product.id === 'keyboard-macro' ? (
                <div className="space-y-3 p-3">
                  <img
                    src="/keyboard-macro-1.png"
                    alt="Keyboard Macro Dashboard"
                    className="w-full rounded-xl object-cover border border-[#2a2a2a]"
                  />
                  <img
                    src="/keyboard-macro-2.png"
                    alt="Keyboard Macro Developer View"
                    className="w-full rounded-xl object-cover border border-[#2a2a2a]"
                  />
                </div>
              ) : product.id === 'zero-delay' ? (
                <div className="space-y-3 p-3">
                  <img
                    src="/zero-delay-1.png"
                    alt="Zero Delay Dashboard"
                    className="w-full rounded-xl object-cover border border-[#2a2a2a]"
                  />
                  <img
                    src="/zero-delay-2.png"
                    alt="Zero Delay Storage View"
                    className="w-full rounded-xl object-cover border border-[#2a2a2a]"
                  />
                </div>
              ) : product.id === 'bloom-reducer' ? (
                <div className="space-y-3 p-3">
                  <img
                    src="/bloom-reducer-1.png"
                    alt="Bloom Reducer Main View"
                    className="w-full rounded-xl object-cover border border-[#2a2a2a]"
                  />
                  <img
                    src="/bloom-reducer-2.png"
                    alt="Bloom Reducer Aim Tweaks"
                    className="w-full rounded-xl object-cover border border-[#2a2a2a]"
                  />
                </div>
              ) : (
                <>
                  <div className="aspect-video relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-50" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative w-full h-full p-12 flex flex-col items-center justify-center text-neutral-700 group-hover:text-yellow-500/30 transition-colors duration-500">
                        <Cpu className="w-24 h-24 mb-4 opacity-20" />
                        <div className="w-full h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-20" />
                        <div className="w-full h-full absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      </div>
                    </div>
                    <div className="absolute bottom-6 left-6 right-6 p-4 bg-[#0f0f0f]/80 backdrop-blur-md rounded-xl border border-[#2a2a2a] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-mono text-neutral-400">STATUS: OPTIMIZED</span>
                      </div>
                      <span className="text-xs font-mono text-yellow-500">v3.2.0</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Features List */}
            <div className="bg-[#141414] rounded-2xl p-8 border border-[#222]">
              <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                <span className="w-1 h-6 bg-yellow-500 rounded-full" />
                Key Features
              </h3>
              <ul className="space-y-4">
                {product.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 group">
                    <div className="mt-1 min-w-[20px] h-[20px] rounded-full bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors">
                      <Check className="w-3 h-3 text-yellow-500" />
                    </div>
                    <span className="text-neutral-300 text-sm leading-relaxed group-hover:text-white transition-colors">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* System Requirements */}
            <div id="requirements" className="bg-[#141414] rounded-2xl p-8 border border-[#222]">
               <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                <span className="w-1 h-6 bg-neutral-600 rounded-full" />
                System Requirements
              </h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {product.requirements.map((req, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-neutral-400 bg-[#0f0f0f] p-3 rounded-lg border border-[#1a1a1a]">
                      <div className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                      {req}
                    </div>
                  ))}
               </div>
            </div>

          </div>
        </div>
      </main>
      
      <footer className="py-12 px-6 border-t border-[#1a1a1a]/50 mt-12 bg-[#0b0b0b]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-sm text-neutral-500">© 2026 Seraphim Tweaks. All rights reserved.</p>
           <div className="flex items-center gap-8 text-sm text-neutral-400">
            <Link href="/"><a className="hover:text-yellow-500 transition-colors">Home</a></Link>
            <a href="https://payhip.com/SeraphimTweaks/contact" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Support</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
