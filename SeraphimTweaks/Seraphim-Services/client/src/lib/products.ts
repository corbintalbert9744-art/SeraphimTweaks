
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
  }
};
