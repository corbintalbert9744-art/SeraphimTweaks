import { Link } from "wouter";

const clickableStyles = "transition-all duration-300 ease-out hover:scale-[1.02] active:scale-95";

const DiscordIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
  </svg>
);

const sections = [
  {
    num: 1,
    title: "License & Permitted Use",
    body: `Seraphim grants you a limited, non-exclusive, non-transferable, revocable license for personal use only. This license is tied to the individual who completed the purchase and may not be shared or transferred. The following actions are strictly prohibited and will result in immediate license termination without refund:`,
    bullets: [
      "Redistribution, resale, sharing, or sublicensing of any Seraphim products",
      "Reverse engineering, decompiling, disassembling, or attempting to extract source code",
      "Modifying, adapting, rebranding, or creating derivative works",
      "Removing, altering, or obscuring any proprietary notices or watermarks",
      "Using the product for commercial purposes or on behalf of third parties",
      "Sharing account credentials or allowing unauthorized access to purchased content",
    ],
  },
  {
    num: 2,
    title: "No Refund Policy",
    body: `All sales are final and non-refundable. Due to the digital nature of our products and the immediate delivery upon purchase, refunds, exchanges, chargebacks, or cancellations are not permitted under any circumstances except where explicitly required by applicable law. By completing a purchase you acknowledge that:`,
    bullets: [
      "You have reviewed all product information, descriptions, and system requirements before buying",
      "You accept full responsibility for verifying compatibility with your system",
      "Dissatisfaction with performance or personal expectations does not qualify for a refund",
      "Filing a chargeback or payment dispute will result in permanent account termination and potential legal action",
    ],
  },
  {
    num: 3,
    title: "User Responsibility & Assumption of Risk",
    body: `Use of Seraphim products is entirely at your own risk. By using our products you assume full responsibility for any and all outcomes, including but not limited to:`,
    bullets: [
      "System performance changes, instability, or unexpected behavior",
      "Data loss, file corruption, or configuration changes",
      "Compatibility issues with hardware, software, or third-party applications",
      "Consequences resulting from improper installation, configuration, or usage",
      "Violations of third-party terms of service (e.g., game publishers)",
    ],
    footer: "You are solely responsible for creating backups and restore points before applying any modifications. Seraphim strongly recommends creating a full system backup prior to installation.",
  },
  {
    num: 4,
    title: "Disclaimer of Warranties",
    body: `Seraphim products are provided "AS IS" and "AS AVAILABLE" without warranties of any kind. To the fullest extent permitted by law, Seraphim expressly disclaims all warranties, including but not limited to:`,
    bullets: [
      "Implied warranties of merchantability, fitness for a particular purpose, and non-infringement",
      "Any warranty that products will meet your specific requirements or expectations",
      "Any warranty that products will be uninterrupted, error-free, or secure",
      "Any warranty regarding the accuracy or completeness of results",
    ],
    footer: "Performance results may vary based on individual system configurations, hardware, and software environments. Any performance claims or testimonials are illustrative only and do not guarantee identical results.",
  },
  {
    num: 5,
    title: "Limitation of Liability",
    body: `To the maximum extent permitted by law, Seraphim and its owners shall not be liable for any direct, indirect, incidental, special, or consequential damages arising from:`,
    bullets: [
      "Your purchase, download, installation, or use of any Seraphim products",
      "Any inability to use our products or services",
      "Any errors, bugs, or inaccuracies in our products",
      "Any loss of data, profits, revenue, or goodwill",
      "Any third-party actions, products, or services",
    ],
    footer: "In no event shall Seraphim's total cumulative liability exceed the amount you paid for the specific product giving rise to the claim.",
  },
  {
    num: 6,
    title: "Product Delivery",
    body: `All products are delivered digitally. Upon successful payment you will receive access to your purchased content via email and/or your account dashboard. If you do not receive your purchase within a reasonable timeframe:`,
    bullets: [
      "Check your spam or junk folder for delivery emails",
      "Verify the email address associated with your purchase",
      "Contact our support team via Discord with your order confirmation for assistance",
    ],
  },
  {
    num: 7,
    title: "Intellectual Property",
    body: `All Seraphim products, content, trademarks, logos, designs, and associated intellectual property are the exclusive property of Seraphim and are protected by applicable copyright and intellectual property laws. Your purchase grants you a license to use the product — it does not transfer ownership of any intellectual property rights. Unauthorized use, reproduction, or distribution may result in civil and criminal penalties.`,
    bullets: [],
  },
  {
    num: 8,
    title: "Account Termination",
    body: `Seraphim reserves the right to suspend or permanently terminate your license and access without prior notice or refund for any violation of these terms, including:`,
    bullets: [
      "Breach of any provision in these Terms of Service",
      "Fraudulent activity, chargebacks, or payment disputes",
      "Unauthorized redistribution or sharing of products",
      "Abusive or threatening behavior toward staff or other users",
      "Any activity deemed harmful to Seraphim or its community",
    ],
  },
  {
    num: 9,
    title: "Modifications to Terms",
    body: `Seraphim reserves the right to update or modify these Terms of Service at any time at our sole discretion. Changes take effect immediately upon posting. Your continued use of Seraphim products after any modifications constitutes acceptance of the revised terms. Material changes may be announced through our official Discord, but we are not obligated to provide individual notice.`,
    bullets: [],
  },
  {
    num: 10,
    title: "Governing Law & Disputes",
    body: `These Terms of Service shall be governed by applicable laws. Any disputes arising from or related to these terms or your use of Seraphim products shall first be resolved through good-faith negotiation. If a resolution cannot be reached, disputes shall be submitted to binding arbitration or the appropriate courts. You agree to waive any right to a jury trial or class action lawsuit.`,
    bullets: [],
  },
  {
    num: 11,
    title: "Severability",
    body: `If any provision of these Terms of Service is found to be invalid or unenforceable, such provision shall be modified to the minimum extent necessary to make it enforceable, or severed if modification is not possible. All remaining provisions shall continue in full force and effect.`,
    bullets: [],
  },
  {
    num: 12,
    title: "Contact Information",
    body: `For questions, concerns, or support requests regarding these Terms or any Seraphim products, please reach out through our official Discord server. Response times may vary based on volume and complexity of inquiries.`,
    bullets: [],
  },
];

export default function Terms() {
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
            <Link href="/reviews"><a className={`text-sm text-neutral-400 hover:text-white ${clickableStyles}`}>Reviews</a></Link>
            <span className="text-sm text-white">Terms</span>
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

      {/* Content */}
      <div className="pt-32 pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">Terms of Service</h1>
            <p className="text-neutral-500 text-sm">© 2025 Seraphim Tweaks. All rights reserved.</p>
            <p className="text-neutral-400 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
              By purchasing, downloading, accessing, or using any Seraphim products or services, you expressly acknowledge that you have read, understood, and agree to be legally bound by the following terms. If you do not agree, do not purchase or use our products.
            </p>
          </div>

          <div className="space-y-5">
            {sections.map((s) => (
              <div key={s.num} className="card-3d p-7 rounded-2xl border border-[#1a1a1a]/80 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-start gap-4 mb-4">
                  <span className="w-8 h-8 rounded-lg bg-yellow-500/15 border border-yellow-500/20 text-yellow-400 text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {s.num}
                  </span>
                  <h2 className="text-lg font-bold text-white pt-1">{s.title}</h2>
                </div>
                {s.body && <p className="text-neutral-400 text-sm leading-relaxed mb-3">{s.body}</p>}
                {s.bullets && s.bullets.length > 0 && (
                  <ul className="space-y-2 mb-3">
                    {s.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-neutral-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/60 mt-1.5 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
                {s.footer && <p className="text-neutral-500 text-sm leading-relaxed mt-3 italic">{s.footer}</p>}
              </div>
            ))}
          </div>

          <p className="text-center text-neutral-600 text-xs mt-10">
            Last Updated: January 2025 · Effective Immediately Upon Posting
          </p>
          <p className="text-center text-neutral-500 text-sm mt-4">
            By using Seraphim products or services, you confirm that you have read, understood, and agree to be bound by these Terms of Service in their entirety.
          </p>
        </div>
      </div>
    </div>
  );
}
