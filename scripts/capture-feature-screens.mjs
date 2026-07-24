import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

/**
 * Captures live Seraphim IQ UI sections for marketing feature examples.
 * Requires: npm run dev on :5000, and puppeteer-core + system Chrome.
 *
 * Each image is a tight screenshot of the matching [data-feature] section.
 */
const OUT = path.resolve("client/public/marketing/features");
fs.mkdirSync(OUT, { recursive: true });

const MEMBERSHIP = {
  user: { name: "Analyst", email: "analyst@seraphim.iq" },
  membershipActive: true,
  plan: "pro",
  billingInterval: "monthly",
};

const CHROME_CSS = `
  .card-3d, .card-3d:hover, .card-3d-popular, .card-3d-popular:hover { transform: none !important; }
  header, aside, [class*="sticky"] { display: none !important; }
  main { margin: 0 !important; padding: 24px !important; max-width: none !important; }
`;

async function wait(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1440, height: 1100, deviceScaleFactor: 1 },
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument((state) => {
    localStorage.setItem("seraphim-iq-membership-v1", JSON.stringify(state));
  }, MEMBERSHIP);

  async function goto(url) {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await wait(2000);
    await page.addStyleTag({ content: CHROME_CSS });
    await wait(400);
    console.log("at", page.url());
  }

  async function shot(file, sel) {
    const el = await page.$(sel);
    if (!el) throw new Error("missing " + sel);
    await el.evaluate((n) => n.scrollIntoView({ block: "center" }));
    await wait(300);
    await el.screenshot({ path: path.join(OUT, file), type: "png" });
    const title = await el.evaluate((n) => (n.innerText || "").split("\n")[0]);
    console.log("saved", file, "→", title);
  }

  await goto("http://127.0.0.1:5000/app/prop/nba-tatum-pts");
  await shot("hit-rates.png", '[data-feature="hit-rates"]');
  await shot("no-vig.png", '[data-feature="metrics-row"]');
  await shot("research-score.png", '[data-feature="research-score"]');
  await shot("ai-analysis.png", '[data-feature="ai-analysis"]');
  await shot("line-movement.png", '[data-feature="line-movement"]');

  await goto("http://127.0.0.1:5000/app/player/tatum");
  const report = await page.$('[data-feature="player-report"]');
  const perf = await page.$('[data-feature="player-performance"]');
  await report.evaluate((n) => n.scrollIntoView({ block: "start" }));
  await wait(300);
  const rb = await report.boundingBox();
  const pb = await perf.boundingBox();
  await page.screenshot({
    path: path.join(OUT, "player-reports.png"),
    type: "png",
    clip: {
      x: Math.min(rb.x, pb.x),
      y: rb.y,
      width: Math.max(rb.width, pb.width),
      height: pb.y + pb.height - rb.y + 8,
    },
  });
  console.log("saved player-reports.png");

  await goto("http://127.0.0.1:5000/app/parlay-builder");
  await page.evaluate(() => {
    [...document.querySelectorAll('[data-feature="parlay-builder"] button')]
      .filter((b) => (b.textContent || "").includes("L10"))
      .slice(0, 3)
      .forEach((b) => b.click());
  });
  await wait(800);
  await shot("parlay-builder.png", '[data-feature="parlay-l10"]');

  // Drop unused full-page leftover if present
  const leftover = path.join(OUT, "command-center.png");
  if (fs.existsSync(leftover)) fs.unlinkSync(leftover);

  await browser.close();
  console.log("done", fs.readdirSync(OUT));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
