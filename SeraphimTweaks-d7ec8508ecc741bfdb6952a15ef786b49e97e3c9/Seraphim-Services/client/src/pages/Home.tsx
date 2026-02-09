import React, { useState, useEffect } from 'react'
import { Link, useLocation } from "wouter";

// Icons
const CheckIcon = () => (
  <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
)

const ChartIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
  </svg>
)

const LockIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
)

const BoltIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
)

const UsersIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
)

const features = [
  { icon: ChartIcon, title: 'FPS Monitoring', desc: 'Track real-time FPS, frame pacing, and performance changes as they happen.' },
  { icon: SparklesIcon, title: 'Smart Performance Tuning', desc: 'Automatically applied tweaks based on your system for maximum performance.' },
  { icon: BoltIcon, title: 'Low Latency Optimization', desc: 'Reduce input delay and improve response time for smoother gameplay.' },
  { icon: LockIcon, title: 'Safe System Tweaks', desc: 'All optimizations are fully reversible and designed to protect system stability.' },
  { icon: UsersIcon, title: 'Game-Specific Presets', desc: 'Optimized settings tailored for Fortnite and other competitive games.' },
  { icon: ChartIcon, title: 'Advanced PC Optimization', desc: 'Deep system tweaks to unlock hidden performance and reduce stutters.' },
]

const pricing = [
  { 
    name: 'FPS Boost', 
    slug: 'fps-boost',
    price: '12.99', 
    period: 'one-time payment', 
    desc: 'Maximize frame rates instantly', 
    features: ['Increases FPS', 'Removes all FPS stutters', ' Optimizes CPU and GPU performance', 'Improves frame stability & smoothness'], 
    cta: 'Buy Now →', 
    checkoutUrl: 'https://seraphimtweaks.com/buy?s=1&cart_links%5B%5D=oRNea&qty%5BoRNea%5D=1', 
    popular: false 
  },
  { 
    name: 'Zero Delay', 
    slug: 'zero-delay',
    price: '19.99', 
    period: 'one-time payment', 
    desc: 'Ultra-low input latency', 
    features: ['Registry tweaks', ' PC & Xbox supported', 'Optimized settings for Fortnite', 'Background service optimization', 'Smoother FPS and frame pacing', 'Reduced input delay & faster response'], 
    cta: 'Buy Now →', 
    checkoutUrl: 'https://seraphimtweaks.com/buy?s=1&cart_links%5B%5D=kjZgR&qty%5BkjZgR%5D=1', 
    popular: true 
  },
  { 
    name: 'Bloom Reducer', 
    slug: 'bloom-reducer',
    price: '12.99', 
    period: 'one-time payment', 
    desc: 'Tighter aim & better accuracy', 
    features: ['Crosshair stability', 'Recoil optimization', 'Bloom reduction tweaks', 'Weapon accuracy enhancement'], 
    cta: 'Buy Now →', 
    checkoutUrl: 'https://seraphimtweaks.com/buy?s=1&cart_links%5B%5D=uXWr4&qty%5BuXWr4%5D=1', 
    popular: false 
  },
]

const testimonials = [
  { quote: "Seraphim Tweaks completely transformed my PC performance. My FPS is higher, gameplay is smoother, and input delay feels way lower.", author: "Bray", role: "Token Professional", avatar: "B" },
  { quote: "Improvements instantly. Zero Delay made everything feel more responsive instantly.", author: "Zyren", role: "Content Creator", avatar: "Z" },
  { quote: "The speed difference is crazy. My game loads faster, stutters are gone, and everything just feels smmoother.", author: "ManMan", role: "Token Professional", avatar: "MM" },
]

const logos = ['MasterCard', 'Visa', 'Venmo', 'PayPal', 'Discover','Cashapp']

export default function Home() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Keep the Payhip script if other parts of the site might need it later, 
    // or remove it if totally unused. The user said "REMOVE the Payhip embed store section",
    // but the checkout buttons on Product Page are external links which might use Payhip JS for modal checkout?
    // The user said "make Buy Now open Payhip checkout in a new tab" which usually means direct link, not modal.
    // I'll leave it out to keep it clean as requested.
  }, []);

  const [billing, setBilling] = useState('monthly')

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white font-sans">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-yellow-500/10 via-amber-500/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-[#121212]/90 backdrop-blur-xl border-b border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
              <div className="bg-transparent px-3 py-2">
              <div className="flex items-center px-5 py-2 rounded-xl bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border border-yellow-500/10">
              <div className="leading-tight">
             <div className="text-lg font-bold text-white">
             Seraphim
             </div>
             <div className="text-xs font-semibold tracking-widest text-yellow-400">
             GAMING TWEAKS
             </div>
             </div>
             </div>
           </div>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-neutral-400 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-neutral-400 hover:text-white transition-colors">Pricing</a>
            <a href="#testimonials" className="text-sm text-neutral-400 hover:text-white transition-colors">Customers</a>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-sm text-slate-300 hover:text-white transition-colors px-4 py-2">Log in</button>
            <button 
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-sm font-medium bg-white text-slate-900 px-4 py-2 rounded-lg transition-colors hover:bg-neutral-200 cursor-pointer"
            >
              🛒 Buy Now
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <SparklesIcon />
            <span>Premium PC & Console Optimization</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
            Seraphim{' '}
            <span className="text-yellow-400 drop-shadow-[0_0_18px_rgba(234,179,8,0.8)]">
                Tweaks
            </span>

            <span className="block mt-2 text-lg tracking-wide leading-relaxed bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
            Unleash Your PC & Console's True Potential
            </span>
          </h1>
          
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            System level optimization module focused on reducing latency. Engineered for stability, safety, and reversibility as core priorities.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-yellow-500/25 text-black">
              Buy Now 🛒
            </button>
            <button
              onClick={() => window.open('https://discord.gg/seraphimservices', '_blank')}
              className="w-full sm:w-auto px-8 py-4 bg-[#141414] border border-neutral-700 rounded-xl font-semibold text-lg transition-colors hover:border-yellow-500/50 hover:text-yellow-400 text-white"
            >
              Discord
            </button>
          </div>
          
          {/* Dashboard Preview */}
          <div className="mt-16 relative animate-in fade-in zoom-in duration-1000 delay-500">
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent z-10 pointer-events-none" />
            <div className="animate-float bg-[#0f0f0f] backdrop-blur border border-[#1a1a1a] rounded-2xl p-4 shadow-2xl shadow-yellow-500/10 max-w-4xl mx-auto">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="grid grid-cols-4 gap-4 mb-4">
                {[
                  { label: 'Total Users', value: '2,103', change: '+12%' },
                  { label: 'Active Now', value: '627', change: '+8%' },
                  { label: 'Revenue', value: '$31.5K', change: '+23%' },
                  { label: 'Conversion', value: '3.2%', change: '+0.4%' },
                ].map((stat, i) => (
                  <div key={i} className="bg-[#141414]/50 rounded-xl p-4">
                    <p className="text-xs text-neutral-500 mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-yellow-400">{stat.change}</p>
                  </div>
                ))}
              </div>
              <div className="h-48 bg-[#141414]/30 rounded-xl flex items-end justify-around p-4">
                {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 95, 80].map((h, i) => (
                  <div key={i} className="w-6 bg-gradient-to-t from-yellow-500 to-amber-500 rounded-t opacity-80 hover:opacity-100 transition-opacity" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos */}
      <section className="py-16 px-6 border-y border-[#1a1a1a]/50 bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-sm text-neutral-500 font-semibold mb-8 uppercase tracking-widest">Trusted by 2k+ people worldwide</p>
          <div className="flex justify-center items-center gap-12 flex-wrap opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            {logos.map((logo, i) => (
              <span key={i} className="text-2xl font-bold text-white cursor-default">{logo}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 relative overflow-hidden">
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Everything you need</h2>
            <p className="text-neutral-400 max-w-xl mx-auto">High-performance tweaks built to boost FPS, reduce delay, and stay affordable for everyone.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div key={i} className="group p-6 rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] hover:border-yellow-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-yellow-500/5">
                <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-400 mb-4 group-hover:bg-yellow-500/20 transition-colors">
                  <feature.icon />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">{feature.title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 bg-[#0b0b0b]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Simple, transparent pricing</h2>
            <p className="text-neutral-400 mb-8">Elevate your gaming today</p>
           
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {pricing.map((plan, i) => (
              <Link key={i} href={`/product/${plan.slug}`}>
                <a className={`relative p-8 rounded-2xl border transition-all duration-300 block h-full ${plan.popular ? 'bg-gradient-to-b from-yellow-500/5 to-neutral-950 border-yellow-500/50 scale-105 shadow-2xl shadow-yellow-500/10' : 'bg-[#0f0f0f] border-[#1a1a1a] hover:border-[#2a2a2a]'}`}>
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-500 text-black rounded-full text-xs font-bold uppercase tracking-wider shadow-lg shadow-yellow-500/20">
                      Most Popular
                    </span>
                  )}
                  <div className="mb-4">
                    <h3 className="text-xl font-bold mb-1 text-white group-hover:text-yellow-400 transition-colors">
                      {plan.name}
                    </h3>
                    <p className="text-sm text-neutral-400 mb-0">{plan.desc}</p>
                  </div>
                  <div className="mb-6">
                    <span className={`font-bold text-white ${plan.price === 'Custom' ? 'text-2xl' : 'text-4xl'}`}>
                      {plan.price === 'Custom' ? '' : '$'}
                      {plan.price}
                    </span>
                    <span className="text-neutral-500 ml-1 font-medium">{plan.period}</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-3 text-sm text-neutral-300">
                        <CheckIcon />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className={`w-full inline-flex justify-center items-center py-4 rounded-xl font-bold transition-all ${plan.popular ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-[#141414] border border-neutral-800 text-white'}`}>
                    {plan.cta}
                  </div>
                </a>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Loved by users everywhere</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="p-6 rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a]/50">
                <p className="text-slate-300 mb-6 leading-relaxed">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center font-bold text-black text-sm">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-white">{t.author}</p>
                    <p className="text-xs text-neutral-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-12 rounded-3xl bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-transparent border border-yellow-500/20 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white relative z-10">Ready to get started?</h2>
            <p className="text-neutral-400 mb-8 max-w-lg mx-auto relative z-10">Join 2,000+ people already using Seraphim to improve their gameplay.</p>
            <button 
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 bg-white text-slate-900 rounded-xl font-semibold text-lg hover:bg-neutral-200 transition-colors relative z-10 cursor-pointer"
            >
              🛒 Buy Now →
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[#1a1a1a]/50 bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
      
          <div className="flex items-center gap-8 text-sm text-neutral-400">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          <p className="text-sm text-neutral-500">© 2026 Seraphim. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
