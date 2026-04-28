
export interface Product {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  description: string;
  features: string[];
  requirements: string[];
  buyLink: string;
  badge?: string;
  slug: string;
  checkoutUrl: string;
}

export interface PricingPlan {
  name: string;
  slug: string;
  price: string;
  period: string;
  desc: string;
  features: string[];
  cta: string;
  checkoutUrl: string;
  popular: boolean;
}

export const pricingPlans: PricingPlan[] = [
  {
    name: 'FPS Boost',
    slug: 'fps-boost',
    price: '12.99',
    period: 'one-time payment',
    desc: 'Maximize frame rates instantly',
    features: ['Increases FPS', 'Removes all FPS stutters', ' Optimizes CPU and GPU performance', 'Improves frame stability & smoothness'],
    cta: 'Buy Now →',
    checkoutUrl: 'https://seraphimtweaks.com/buy?s=1&cart_links%5B%5D=oRNea&qty%5BoRNea%5D=1',
    popular: false,
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
    popular: true,
  },
  {
    name: 'Keyboard Macro',
    slug: 'keyboard-macro',
    price: '29.99',
    period: 'one-time payment',
    desc: 'Instant edits at the press of a key',
    features: ['Instant Drag Edits', 'Single Press Double Edits', 'Instant Build Feature', 'Pick Up Macro', 'Safe and Undetectable'],
    cta: 'Buy Now →',
    checkoutUrl: 'https://payhip.com/buy?s=1&cart_links%5B%5D=Ff4v6&qty%5BFf4v6%5D=1',
    popular: false,
  },
  {
    name: 'Xbox Zero Delay',
    slug: 'xbox-zero-delay',
    price: '9.99',
    period: 'one-time payment',
    desc: 'Optimized for Xbox Series X/S',
    features: ['Optimized for Xbox Series X/S', 'Reduced input latency', 'Smoother gameplay', 'Enhanced response time', 'Safe and reversible tweaks', 'Instant activation'],
    cta: 'Buy Now →',
    checkoutUrl: 'https://seraphimtweaks.com/buy?s=1&cart_links%5B%5D=JYnlv&qty%5BJYnlv%5D=1',
    popular: false,
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
    popular: false,
  },
];

export const products: Record<string, Product> = {
  "fps-boost": {
    id: "fps-boost",
    slug: "fps-boost",
    name: "FPS Boost",
    subtitle: "Maximize frame rates instantly",
    price: "12.99",
    description: "Our core optimization package designed to squeeze every frame out of your hardware. Perfect for competitive gamers who need stable, high refresh rates without compromising visual clarity.",
    features: [
      "Increases FPS",
      "Removes all FPS stutters",
      "Optimizes CPU and GPU performance",
      "Improves frame stability & smoothness",
      "Custom power plan configuration",
      "Background process cleanup"
    ],
    requirements: [
      "Windows 10 or 11",
      "Administrator privileges",
      "50MB free disk space",
      "Internet connection for verification"
    ],
    buyLink: "https://seraphimtweaks.com/buy?s=1&cart_links%5B%5D=oRNea&qty%5BoRNea%5D=1",
    checkoutUrl: "https://seraphimtweaks.com/buy?s=1&cart_links%5B%5D=oRNea&qty%5BoRNea%5D=1"
  },
  "zero-delay": {
    id: "zero-delay",
    slug: "zero-delay",
    name: "Zero Delay",
    subtitle: "Ultra-low input latency",
    price: "19.99",
    description: "The ultimate competitive advantage. Reduce input lag to the absolute minimum with kernel-level optimizations and registry tweaks specifically tuned for responsiveness.",
    badge: "Most Popular",
    features: [
      "Registry tweaks for latency",
      "PC & Xbox controller supported",
      "Optimized settings for Fortnite & Apex",
      "Background service optimization",
      "Smoother FPS and frame pacing",
      "Reduced input delay & faster response",
      "USB polling rate optimization",
      "Network latency reduction"
    ],
    requirements: [
      "Windows 10 or 11",
      "Administrator privileges",
      "50MB free disk space",
      "Internet connection for verification"
    ],
    buyLink: "https://seraphimtweaks.com/buy?s=1&cart_links%5B%5D=kjZgR&qty%5BkjZgR%5D=1",
    checkoutUrl: "https://seraphimtweaks.com/buy?s=1&cart_links%5B%5D=kjZgR&qty%5BkjZgR%5D=1"
  },
  "bloom-reducer": {
    id: "bloom-reducer",
    slug: "bloom-reducer",
    name: "Bloom Reducer",
    subtitle: "Tighter aim & better accuracy",
    price: "12.99",
    description: "Refine your aiming mechanics by optimizing how games handle weapon bloom and recoil patterns. Experience cleaner engagements and more consistent hits.",
    features: [
      "Crosshair stability",
      "Recoil optimization",
      "Bloom reduction tweaks",
      "Weapon accuracy enhancement",
      "Mouse curve optimization",
      "Visual clutter reduction"
    ],
    requirements: [
      "Windows 10 or 11",
      "Administrator privileges",
      "50MB free disk space",
      "Internet connection for verification"
    ],
    buyLink: "https://seraphimtweaks.com/buy?s=1&cart_links%5B%5D=uXWr4&qty%5BuXWr4%5D=1",
    checkoutUrl: "https://seraphimtweaks.com/buy?s=1&cart_links%5B%5D=uXWr4&qty%5BuXWr4%5D=1"
  },
  "xbox-zero-delay": {
    id: "xbox-zero-delay",
    slug: "xbox-zero-delay",
    name: "Xbox Zero Delay",
    subtitle: "Optimized for Xbox Series X/S",
    price: "9.99",
    description: "Experience ultra-low latency on your Xbox console. Specifically engineered to reduce input delay and improve responsiveness for competitive console gaming, providing a smoother and more consistent experience. Optimized for Xbox Series X/S.",
    features: [
      "Optimized for Xbox Series X/S",
      "Reduced input latency",
      "Smoother gameplay",
      "Enhanced response time",
      "Safe and reversible tweaks",
      "Instant activation",
      "System-level optimization",
      "Priority packet handling"
    ],
    requirements: [
      "Xbox Series X & Xbox Series S",
      "Active Internet Connection",
      "Compatible Controller",
      "No specialized hardware required"
    ],
    buyLink: "https://seraphimtweaks.com/buy?s=1&cart_links%5B%5D=JYnlv&qty%5BJYnlv%5D=1",
    checkoutUrl: "https://seraphimtweaks.com/buy?s=1&cart_links%5B%5D=JYnlv&qty%5BJYnlv%5D=1"
  },
  "keyboard-macro": {
    id: "keyboard-macro",
    slug: "keyboard-macro",
    name: "Keyboard Macro",
    subtitle: "Instant edits at the press of a key",
    price: "29.99",
    description: "This Keyboard macro with adjustable delays designed for the fastest possible edit speed and consistency with lifetime access",
    features: [
      "Instant Drag Edits",
      "Single Press Double Edits",
      "Instant Build Feature",
      "Pick Up Macro",
      "Safe and Undetectable"
    ],
    requirements: [
      "Windows 10 or 11",
      "Administrator privileges",
      "Compatible keyboard",
      "Internet connection for verification"
    ],
    buyLink: "https://payhip.com/buy?s=1&cart_links%5B%5D=Ff4v6&qty%5BFf4v6%5D=1",
    checkoutUrl: "https://payhip.com/buy?s=1&cart_links%5B%5D=Ff4v6&qty%5BFf4v6%5D=1"
  }
};
