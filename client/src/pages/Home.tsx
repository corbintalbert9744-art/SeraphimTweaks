import React, { useState, useEffect } from 'react'
import { Link, useLocation } from "wouter";
import { pricingPlans } from "@/lib/products";

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

const pricing = pricingPlans;

const testimonials = [
  { quote: "ngl i was skeptical at first but this actually cracked. went from 140 fps with drops to a clean 240 locked. ain't no way tf", author: "Anonymous", role: "Zero Delay Tweaks", avatar: "A" },
  { quote: "bloom reducer is disgusting fr. flicks feel buttery, shots actually register now. paid for itself after one tourney lowkey", author: "Anonymous", role: "Bloom Reducer", avatar: "A" },
  { quote: "macro hits different bro. double edits on controller feel like im on kbm fr. delay adjustment is clutch for diff scenarios", author: "Anonymous", role: "Seraphim Macro", avatar: "A" },
  { quote: "bro my xbox was cooked before this. running cod no stutters now idk what they did but it works. worth every dollar", author: "Anonymous", role: "Xbox Tweaks", avatar: "A" },
  { quote: "tried other macros and they all flagged lookin sus. this one clean, undetectable, and consistent af. runs like butter on mnk too", author: "Anonymous", role: "Seraphim Macro", avatar: "A" },
  { quote: "been using tweaks for 3 months no issues. updates drop every couple weeks too which is nuts. set n forget type beat", author: "Anonymous", role: "Zero Delay Tweaks", avatar: "A" },
  { quote: "Went from 144 FPS to 240 stable after getting FPS tweaks. genuinely insane difference in competitive lobbies", author: "Bray", role: "FPS Boost", avatar: "B" },
  { quote: "Zero Delay makes it feel like I'm on 0 ping. inputs register so clean now, night and day difference fr", author: "Zyren", role: "Zero Delay Tweaks", avatar: "Z" },
]

const logos = ['MasterCard', 'Visa', 'Venmo', 'PayPal', 'Discover','Cashapp']

const TweakCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const screenshots = [
    {
      url: '/screenshots/zero-delay.png',
      title: 'Seraphim Zero Delay Suite'
    },
    {
      url: '/screenshots/fps-boost.png',
      title: 'Seraphim FPS Boost Suite'
    },
    {
      url: '/screenshots/bloom-reducer.png',
      title: 'Seraphim Bloom Reducer'
    }
  ];

  const next = () => setCurrentIndex((prev) => (prev + 1) % screenshots.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + screenshots.length) % screenshots.length);

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="relative max-w-4xl mx-auto group">
          {/* Main Container */}
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl overflow-hidden shadow-2xl relative">
            {/* Window Controls */}
            <div className="flex items-center gap-2 p-4 border-b border-[#1a1a1a] bg-[#121212]">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="ml-4 text-xs font-medium text-neutral-500 uppercase tracking-widest">
                {screenshots[currentIndex].title}
              </span>
            </div>

            {/* Image Area */}
            <div className="relative aspect-video bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
              <img 
                key={currentIndex}
                src={screenshots[currentIndex].url} 
                alt={screenshots[currentIndex].title}
                className="w-full h-full object-cover animate-in fade-in duration-500"
              />
              
              {/* Navigation Arrows */}
              <button 
                onClick={prev}
                className="absolute left-4 p-2 rounded-full bg-black/40 text-yellow-500/70 hover:text-yellow-400 hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100 focus:outline-none"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <button 
                onClick={next}
                className="absolute right-4 p-2 rounded-full bg-black/40 text-yellow-500/70 hover:text-yellow-400 hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100 focus:outline-none"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Subtle Inner Glow Effect */}
          <div className="absolute -inset-0.5 bg-yellow-500/5 rounded-2xl blur-xl -z-10" />
        </div>
      </div>
    </section>
  );
};

const DashboardPreview = () => {
  return <TweakCarousel />;
};

const PerformanceStats = () => {
  const [stats, setStats] = useState({
    fps: { before: 130, after: 294 },
    delay: { before: 11.5, after: 4.2 },
    ping: { before: 51, after: 3.2 }
  });

  useEffect(() => {
    // Before Loop: every 0.2s
    const beforeInterval = setInterval(() => {
      setStats(prev => {
        // Before FPS: ±1 to ±3 (Range: 100-160)
        const fpsDelta = (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1);
        let nextFpsBefore = prev.fps.before + fpsDelta;
        nextFpsBefore = Math.max(100, Math.min(160, nextFpsBefore));

        // Before Delay: ±0.1 to ±0.3 (Range: 9-14)
        const delayDelta = (Math.random() * 0.2 + 0.1) * (Math.random() > 0.5 ? 1 : -1);
        let nextDelayBefore = prev.delay.before + delayDelta;
        nextDelayBefore = Math.max(9, Math.min(14, nextDelayBefore));

        // Before Ping: ±1 to ±3 (Range: 48-54)
        const pingDelta = (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1);
        let nextPingBefore = prev.ping.before + pingDelta;
        nextPingBefore = Math.max(48, Math.min(54, nextPingBefore));

        return {
          ...prev,
          fps: { ...prev.fps, before: Math.round(nextFpsBefore) },
          delay: { ...prev.delay, before: Number(nextDelayBefore.toFixed(1)) },
          ping: { ...prev.ping, before: Math.round(nextPingBefore) }
        };
      });
    }, 200);

    // After Loop: every 1.0s
    const afterInterval = setInterval(() => {
      setStats(prev => {
        // After FPS: ±1 to ±4 (Range: 220-320)
        // Must be >= Before + 30
        const fpsDelta = (Math.random() * 3 + 1) * (Math.random() > 0.5 ? 1 : -1);
        let nextFpsAfter = prev.fps.after + fpsDelta;
        nextFpsAfter = Math.max(prev.fps.before + 30, Math.min(320, Math.max(220, nextFpsAfter)));

        // After Delay: ±0.1 to ±0.4 (Range: 2-8)
        // Must be <= Before - 5
        const delayDelta = (Math.random() * 0.3 + 0.1) * (Math.random() > 0.5 ? 1 : -1);
        let nextDelayAfter = prev.delay.after + delayDelta;
        nextDelayAfter = Math.max(2, Math.min(8, Math.min(prev.delay.before - 5, nextDelayAfter)));

        // After Ping: ±0.1 to ±0.4 (Range: 2-6)
        const pingDelta = (Math.random() * 0.3 + 0.1) * (Math.random() > 0.5 ? 1 : -1);
        let nextPingAfter = prev.ping.after + pingDelta;
        nextPingAfter = Math.max(2, Math.min(6, nextPingAfter));

        return {
          ...prev,
          fps: { ...prev.fps, after: Math.round(nextFpsAfter) },
          delay: { ...prev.delay, after: Number(nextDelayAfter.toFixed(1)) },
          ping: { ...prev.ping, after: Number(nextPingAfter.toFixed(1)) }
        };
      });
    }, 1000);

    return () => {
      clearInterval(beforeInterval);
      clearInterval(afterInterval);
    };
  }, []);

  const Card = ({ title, before, after, unit, isLowerBetter = false }: any) => {
    // Improvement % is static based on initial values
    const [improvement] = useState(() => {
      if (title === 'Network Ping') return '94.1';
      const initialBefore = title === 'Average FPS' ? 156 : (title === 'Input Delay' ? 18.4 : 51);
      const initialAfter = title === 'Average FPS' ? 294 : (title === 'Input Delay' ? 4.2 : 3.2);
      return isLowerBetter 
        ? ((initialBefore - initialAfter) / initialBefore * 100).toFixed(1)
        : ((initialAfter - initialBefore) / initialBefore * 100).toFixed(1);
    });

    return (
      <div className="p-8 rounded-2xl bg-[#0a0a0a] border border-[#1a1a1a] group relative overflow-hidden">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-400">
            {title === 'Average FPS' && <ChartIcon />}
            {title === 'Input Delay' && <BoltIcon />}
            {title === 'Network Ping' && <SparklesIcon />}
          </div>
          <h3 className="text-white text-lg font-bold uppercase tracking-tight">{title}</h3>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-end border-b border-[#1a1a1a] pb-4">
            <span className="text-neutral-500 text-sm font-medium">Before</span>
            <span className="text-2xl font-bold text-neutral-400">{before}{unit}</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-yellow-500/70 text-sm font-medium">After</span>
            <span className="text-4xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.4)]">{after}{unit}</span>
          </div>
        </div>

        <div className="mt-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-sm font-black text-green-400">+{improvement}% improvement</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <Card title="Average FPS" before={stats.fps.before} after={stats.fps.after} unit="" />
          <Card title="Input Delay" before={stats.delay.before} after={stats.delay.after} unit="ms" isLowerBetter={true} />
          <Card title="Network Ping" before={stats.ping.before} after={stats.ping.after} unit="ms" isLowerBetter={true} />
        </div>
      </div>
    </section>
  );
};

export default function Home() {
  const [, setLocation] = useLocation();
  const clickableStyles = "transition-all duration-300 hover:outline hover:outline-1 hover:outline-yellow-500/50 hover:shadow-[0_0_15px_rgba(234,179,8,0.3)]";

  return (
    <div className="min-h-screen text-white font-sans relative">
      {/* Golden ambient sparkles */}
      <div className="gold-sparkles" />
      {/* Subtle grid overlay */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-black/70 backdrop-blur-xl border-b border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/">
            <a className="flex items-center gap-3 group cursor-pointer transition-all duration-300">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_10px_4px_rgba(234,179,8,0.75)] block flex-shrink-0 group-hover:shadow-[0_0_14px_6px_rgba(234,179,8,0.9)] transition-all" />
              <span className="text-xl font-bold text-white tracking-tight">Seraphim Tweaks</span>
            </a>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <span className="text-sm text-white">Home</span>
            <Link href="/pricing"><a className={`text-sm text-neutral-400 hover:text-white ${clickableStyles}`}>Products</a></Link>
            <Link href="/reviews"><a className={`text-sm text-neutral-400 hover:text-white ${clickableStyles}`}>Reviews</a></Link>
            <Link href="/terms"><a className={`text-sm text-neutral-400 hover:text-white ${clickableStyles}`}>Terms</a></Link>
            <button onClick={() => window.open('https://discord.gg/yP4uBqNyrP', '_blank')} className={`text-sm text-neutral-400 hover:text-white flex items-center gap-1.5 ${clickableStyles}`}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
              Discord
            </button>
          </div>

          <Link href="/pricing">
            <a className={`text-sm font-medium bg-white text-slate-900 px-4 py-2 rounded-lg cursor-pointer inline-block ${clickableStyles}`}>
              Purchase Now →
            </a>
          </Link>
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
            <Link href="/pricing">
              <a className={`btn-3d w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-white rounded-2xl font-semibold text-lg text-black ${clickableStyles}`}>
                View Products
              </a>
            </Link>
            <button
              onClick={() => window.open('https://discord.gg/yP4uBqNyrP', '_blank')}
              className={`btn-3d w-full sm:w-auto px-8 py-4 bg-[#141414] border border-neutral-700 rounded-2xl font-semibold text-lg text-white inline-flex items-center justify-center gap-2.5 ${clickableStyles}`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
              Join Discord
            </button>
          </div>
        </div>
      </section>

      {/* 1. Performance Comparison Cards (Primary Proof Point) */}
      <PerformanceStats />

      {/* 2. Dashboard Preview (Secondary Proof Point) */}
      <DashboardPreview />

      {/* 3. Trusted Logos Section (Social Proof) */}
      <section className="py-16 px-6 border-y border-[#1a1a1a]/50 bg-black/50 backdrop-blur-sm relative">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-sm text-neutral-500 font-semibold mb-8 uppercase tracking-widest">Trusted by 2k+ people worldwide</p>
          <div className="flex justify-center items-center gap-12 flex-wrap opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            {logos.map((logo, i) => (
              <span key={i} className={`text-2xl font-bold text-white cursor-default rounded px-2 ${clickableStyles}`}>{logo}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 relative overflow-hidden">
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Everything you need</h2>
            <p className="text-neutral-400 max-w-xl mx-auto">High-performance tweaks built to boost FPS, reduce delay, and stay affordable for everyone.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div key={i} className={`card-3d group p-8 rounded-2xl border border-[#1a1a1a] ${clickableStyles}`}>
                <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-400 mb-6 group-hover:bg-yellow-500/20 transition-colors">
                  <feature.icon />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-white">{feature.title}</h3>
                <p className="text-neutral-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Loved by users everywhere</h2>
          </div>
        </div>
        <div className="marquee-mask overflow-hidden">
          <div className="marquee-track flex gap-6">
            {[...testimonials, ...testimonials, ...testimonials, ...testimonials].map((t, i) => (
              <div
                key={i}
                className="card-3d shrink-0 w-[340px] md:w-[380px] p-8 rounded-2xl border border-[#1a1a1a]/50"
              >
                <p className="text-slate-300 mb-8 leading-relaxed text-lg">"{t.quote}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center font-bold text-black text-lg">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{t.author}</p>
                    <p className="text-sm text-neutral-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className={`p-16 rounded-3xl bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-transparent border border-yellow-500/20 relative overflow-hidden group ${clickableStyles}`}>
            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white relative z-10">Ready to get started?</h2>
            <p className="text-xl text-neutral-400 mb-10 max-w-lg mx-auto relative z-10">Join 2,000+ people already using Seraphim to improve their gameplay.</p>
            <Link href="/pricing">
              <a className={`btn-3d inline-block px-10 py-5 bg-white text-slate-900 rounded-xl font-bold text-xl relative z-10 cursor-pointer ${clickableStyles}`}>
                🛒 Buy Now →
              </a>
            </Link>
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
  )
}
