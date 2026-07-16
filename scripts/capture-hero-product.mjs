import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

/**
 * Premium landscape hero: Prop research desk (Tatum Points), not the sparse board table.
 */
const OUT = path.resolve("client/public/marketing/hero-product.png");
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const MEMBERSHIP = {
  user: { name: "Analyst", email: "analyst@seraphim.iq" },
  membershipActive: true,
  plan: "pro",
  billingInterval: "monthly",
};

async function wait(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
    defaultViewport: { width: 1480, height: 1100, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument((state) => {
    localStorage.setItem("seraphim-iq-membership-v1", JSON.stringify(state));
  }, MEMBERSHIP);

  await page.goto("http://127.0.0.1:5000/app/prop/nba-tatum-pts", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await wait(2200);

  await page.addStyleTag({
    content: `
      .card-3d, .card-3d:hover, .card-3d-popular, .card-3d-popular:hover {
        transform: none !important;
      }
      body { background: #050505 !important; }
      aside { display: none !important; }
      /* Tighten vertical rhythm so more product fits in the hero frame */
      main { margin-left: 0 !important; padding-top: 12px !important; padding-bottom: 12px !important; }
      main h1 { font-size: 1.65rem !important; line-height: 1.2 !important; }
    `,
  });
  await wait(400);

  // Scroll so the research desk (sides + metrics + analysis) is centered.
  await page.evaluate(() => {
    const target = document.querySelector('[data-feature="metrics-row"]');
    if (target) target.scrollIntoView({ block: "center" });
  });
  await wait(350);

  const clip = await page.evaluate(() => {
    const header = document.querySelector("header");
    const main = document.querySelector("main") || document.body;
    const sides = document.querySelector('[data-side="over"], [class*="RECOMMENDED"]')?.closest("section, div");
    // Find Over/Under pair by looking for Recommended badge text
    let startEl = null;
    for (const el of document.querySelectorAll("button, div, section, article")) {
      const t = (el.textContent || "").trim();
      if (t.startsWith("Over") && t.includes("Recommended")) {
        startEl = el;
        break;
      }
    }
    const metrics = document.querySelector('[data-feature="metrics-row"]');
    const hitRates = document.querySelector('[data-feature="hit-rates"]');
    const movement = document.querySelector('[data-feature="line-movement"]');
    const score = document.querySelector('[data-feature="research-score"]');

    const left = Math.max(20, main.getBoundingClientRect().left);
    const right = Math.min(window.innerWidth - 20, main.getBoundingClientRect().right);
    const width = right - left;
    const ratio = 16 / 11;
    const height = width / ratio;

    // Prefer starting at Over/Under cards; fall back to just under sticky header.
    const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
    const startCandidate = startEl
      ? startEl.getBoundingClientRect().top - 18
      : metrics
        ? metrics.getBoundingClientRect().top - 100
        : headerBottom + 8;
    const y = Math.max(headerBottom + 4, Math.min(startCandidate, window.innerHeight - height - 8));

    // Nudge so hit-rates / movement stay in frame when possible
    void sides;
    void hitRates;
    void movement;
    void score;

    return { x: left, y, width, height };
  });

  await page.screenshot({
    path: OUT,
    type: "png",
    clip: {
      x: Math.round(clip.x),
      y: Math.round(Math.max(0, clip.y)),
      width: Math.round(clip.width),
      height: Math.round(clip.height),
    },
  });

  const { size } = fs.statSync(OUT);
  console.log(
    "saved",
    OUT,
    `${Math.round(clip.width)}x${Math.round(clip.height)} @2x`,
    `${Math.round(size / 1024)}KB`,
  );
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
