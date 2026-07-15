import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const OUT = path.resolve("client/public/marketing/features");
fs.mkdirSync(OUT, { recursive: true });

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
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument((state) => {
    localStorage.setItem("seraphim-iq-membership-v1", JSON.stringify(state));
  }, MEMBERSHIP);

  async function goto(url) {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await wait(2200);
    console.log("at", page.url());
  }

  async function shotMain(file) {
    const el = await page.$("main");
    if (!el) throw new Error("main not found for " + file);
    await el.screenshot({ path: path.join(OUT, file), type: "png" });
    console.log("saved", file);
  }

  async function shotSelector(file, selector) {
    const el = await page.$(selector);
    if (!el) {
      console.warn("missing", selector, "fallback main");
      await shotMain(file);
      return;
    }
    await el.screenshot({ path: path.join(OUT, file), type: "png" });
    console.log("saved", file, selector);
  }

  // Historical hit rates + no-vig live on NBA board
  await goto("http://127.0.0.1:5000/app/nba");
  await shotMain("hit-rates.png");
  await shotMain("no-vig.png");

  // Prop detail — research score / AI / line movement
  await goto("http://127.0.0.1:5000/app/prop/nba-tatum-pts");
  await shotMain("research-score.png");
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("h2,h3,p")].find((n) =>
      /analysis|why|research score|line/i.test(n.textContent || ""),
    );
    el?.scrollIntoView({ block: "start" });
  });
  await wait(500);
  await shotMain("ai-analysis.png");
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("h2,h3")].find((n) =>
      /line|movement|books/i.test(n.textContent || ""),
    );
    el?.scrollIntoView({ block: "start" });
  });
  await wait(500);
  await shotMain("line-movement.png");

  await goto("http://127.0.0.1:5000/app/player/tatum");
  await shotMain("player-reports.png");

  // Seed a leg so parlay builder isn't empty
  await goto("http://127.0.0.1:5000/app/nba");
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      /add/i.test(b.textContent || ""),
    );
    btn?.click();
  });
  await wait(400);
  await goto("http://127.0.0.1:5000/app/parlay-builder");
  await shotMain("parlay-builder.png");

  await goto("http://127.0.0.1:5000/app");
  await shotMain("command-center.png");

  await browser.close();
  console.log("files", fs.readdirSync(OUT));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
