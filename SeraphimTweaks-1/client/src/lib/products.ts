
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
    buyLink: "https://seraphimtweaks.com/b/oRNea",
    checkoutUrl: "https://seraphimtweaks.com/b/oRNea"
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
    buyLink: "https://seraphimtweaks.com/b/kjZgR",
    checkoutUrl: "https://seraphimtweaks.com/b/kjZgR"
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
    buyLink: "https://seraphimtweaks.com/b/uXWr4",
    checkoutUrl: "https://seraphimtweaks.com/b/uXWr4"
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
    buyLink: "https://seraphimtweaks.com/b/JYnlv",
    checkoutUrl: "https://seraphimtweaks.com/b/JYnlv"
  }
};
