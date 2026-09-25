/**
 * Renders the share cards into public/og/: home, about, and one per category,
 * 1200×630, with the Chrome on this machine. Set CHROME to its path if
 * `google-chrome` is not on PATH. The style follows the landing's cards
 * (signalscout-cloud landing/social-cards/cards.html).
 *
 *   node scripts/render-cards.ts
 *
 * The examples on each card are illustrations written for the card, not posts
 * from the feed: a card is rendered once and shared for months, and a real
 * post on it would outlive the post itself.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { categories } from "../src/sort/categories.ts";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "public", "og");
const chrome = process.env.CHROME ?? "google-chrome";
const font = (weight: number) =>
  pathToFileURL(join(root, `node_modules/@fontsource/figtree/files/figtree-latin-${weight}-normal.woff2`)).href;
const mark = pathToFileURL(join(root, "public/mark.svg")).href;
const reddit = pathToFileURL(join(root, "public/brands/reddit.png")).href;
const x = pathToFileURL(join(root, "public/brands/x.png")).href;

/** Two illustrative asks per category, in the words people use. */
const examples: Record<string, [string, string]> = {
  "sales-crm": ["A simple CRM with follow-up reminders for a 3-person team", "A CRM that logs Gmail threads to deals"],
  marketing: ["A cheaper newsletter tool for 3,000 contacts", "Something to schedule posts across LinkedIn and X"],
  finance: ["Invoicing that chases late payments for me", "Bookkeeping software cheaper than QuickBooks"],
  productivity: ["A note app with no AI that syncs offline", "A calendar that books meetings across time zones"],
  "project-management": ["Project management with dependencies for 12 people", "A Trello alternative that handles sprints"],
  design: ["A drawing app for iPad besides Procreate", "What do you use to make these icon animations?"],
  "video-audio": ["A video editor for YouTube that runs on an old laptop", "Podcast recording software for remote guests"],
  "developer-ai": ["CI/CD for iOS and Android apps", "A free host for a small static site"],
  security: ["A password manager with SSO for 40 people", "Cloud backup for Windows, under $100 a year"],
  "work-platforms": ["An alternative to Upwork to find clients", "Where to sell handmade earrings online"],
  "consumer-apps": ["A podcast app that syncs across devices", "A habit tracker that works offline"],
  computers: ["A laptop for video editing under $1,500", "A light laptop for university, under £300"],
  phones: ["A phone under ₹23k with a good camera", "A small Android phone with a big battery"],
  audio: ["Noise-cancelling headphones for a loud office", "Wired PC headphones for a big head"],
  cameras: ["A beginner camera for bird photography", "A webcam that looks good in low light"],
  "home-office": ["An office chair for 8 hours a day under $400", "A standing desk that does not wobble"],
  "tools-electronics": ["A stackable tool chest with deep drawers", "A 3D printer for a complete beginner"],
  "home-kitchen": ["A robot vacuum for a house with two dogs", "A quiet dishwasher that lasts"],
  beauty: ["A glycolic acid for acne-prone skin", "A beard trimmer that lasts more than a year"],
  fashion: ["Winter boots to replace my Sorels", "A crossbody bag that fits a 16-inch laptop"],
  "baby-kids": ["A car seat that leaves the front seat usable", "A stroller that folds with one hand"],
  "cars-bikes": ["A reliable used car under $15,000", "An e-bike for a 20 km commute"],
  "sports-outdoors": ["A two-person tent under 2 kg", "Running shoes for flat feet"],
  gaming: ["A racing game like CarX Street for a handheld", "Is the Overwatch battle pass worth buying?"],
  health: ["Compression sleeves for joint pain", "A sleep tracker without a subscription"],
  pets: ["A quiet filter for a 20-gallon tank", "A GPS tracker for a small dog"],
  "web-development": ["A developer to move a Shopify store, fixed price", "A simple booking site for a small clinic"],
  "ai-automation": ["Someone to build a support chatbot on our docs", "Automate invoices from Gmail into QuickBooks"],
  "marketing-services": ["An agency to run Google Ads for a dental practice", "Technical SEO help after a site migration"],
  "design-services": ["A logo for a medical spa, about $25", "A designer for a 12-slide pitch deck"],
  "content-services": ["A B2B SaaS copywriter, $15–25 an hour", "An editor for short-form videos, 10 a week"],
  "accounting-legal": ["A bookkeeper for 18 rental properties", "A lawyer to set up a US company from abroad"],
  "it-services": ["A security audit before a SOC 2 report", "IT support for a 10-person office"],
  "virtual-assistants": ["A part-time VA for inbox and scheduling", "A cold caller for real estate, part-time"],
  consulting: ["A fractional CMO for a seed-stage startup", "A sales coach for a two-person team"],
};

interface Card {
  file: string;
  eyebrow: string;
  headline: string;
  lede: string;
  asks: [string, string];
}

const cards: Card[] = [
  {
    file: "home.png",
    eyebrow: "SignalScout Radar",
    headline: "People asking what to buy, right now.",
    lede: "Products to buy and services to hire, from Reddit and X, every hour.",
    asks: ["A simple CRM with follow-up reminders for a 3-person team", "Noise-cancelling headphones for a loud office"],
  },
  {
    file: "about.png",
    eyebrow: "How Radar works",
    headline: "Every hour, the posts that ask for a product.",
    lede: "Built on SignalScout's open-source engine. No names, just the ask and a link.",
    asks: ["An alternative to Upwork to find clients", "A laptop for video editing under $1,500"],
  },
  ...categories.map((category) => ({
    file: `c/${category.slug}.png`,
    eyebrow: `Radar · ${{ software: "Software", services: "Services to hire", goods: "Things people buy" }[category.kind]}`,
    headline: `People asking for ${category.name}`,
    lede: "Posts from Reddit and X, sorted every hour.",
    asks: examples[category.slug] ?? ["", ""],
  })),
];

function escape(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function html(card: Card): string {
  const size = card.headline.length > 34 ? 64 : 76;
  const ask = (text: string, icon: string, where: string, strong: boolean) => `
    <div class="ask${strong ? " strong" : ""}">
      <div class="meta"><img src="${icon}" alt="" />${where}</div>
      <p><b>Wants:</b> ${escape(text)}</p>
    </div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: Figtree; font-weight: 500; src: url("${font(500)}"); }
    @font-face { font-family: Figtree; font-weight: 600; src: url("${font(600)}"); }
    @font-face { font-family: Figtree; font-weight: 700; src: url("${font(700)}"); }
    * { box-sizing: border-box; margin: 0; }
    html, body { width: 1200px; height: 630px; overflow: hidden; font-family: Figtree, sans-serif; color: #202124; }
    body {
      display: flex; padding: 52px 56px; gap: 44px;
      background:
        radial-gradient(circle at 8% 22%, #d3e9fd 0, rgb(211 233 253 / 0%) 34%),
        radial-gradient(circle at 92% 88%, #f1e9fb 0, rgb(241 233 251 / 0%) 30%),
        radial-gradient(circle, #dfe3ea 1.2px, transparent 1.4px) 0 0 / 24px 24px,
        #f8fafd;
    }
    .copy { width: 560px; display: flex; flex-direction: column; }
    .brand { display: flex; align-items: center; gap: 14px; font-size: 22px; font-weight: 600; }
    .brand img { width: 38px; height: 38px; }
    .pill { background: #e8f0fe; color: #0b57d0; font-size: 13px; letter-spacing: 0.08em; padding: 5px 10px; border-radius: 99px; }
    .eyebrow { display: flex; align-items: center; gap: 10px; margin-top: auto; color: #0b57d0; font-size: 15px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
    .eyebrow::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #0b57d0; }
    h1 { margin-top: 18px; font-size: ${size}px; font-weight: 700; letter-spacing: -0.035em; line-height: 1.04; }
    .lede { margin-top: 22px; font-size: 22px; line-height: 1.45; color: #5f6368; }
    .site { margin-top: 26px; font-size: 17px; font-weight: 600; color: #3c4043; }
    .visual { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 16px; }
    .ask { background: rgb(255 255 255 / 88%); border: 1px solid #e3e3e3; border-radius: 18px; padding: 20px 22px; box-shadow: 0 1px 2px rgb(20 24 21 / 4%), 0 18px 44px rgb(20 24 21 / 8%); }
    .ask.strong { border-color: #8ab4f8; }
    .meta { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #5f6368; }
    .meta img { width: 18px; height: 18px; border-radius: 4px; }
    .ask p { margin-top: 12px; font-size: 19px; line-height: 1.4; background: #e8f0fe; border-radius: 12px; padding: 10px 14px; }
    .ask b { color: #0b57d0; }
  </style></head><body>
    <div class="copy">
      <div class="brand"><img src="${mark}" alt="" />SignalScout <span class="pill">RADAR</span></div>
      <div class="eyebrow">${escape(card.eyebrow)}</div>
      <h1>${escape(card.headline)}</h1>
      <p class="lede">${escape(card.lede)}</p>
      <p class="site">radar.signalscout.run</p>
    </div>
    <div class="visual">
      ${ask(card.asks[0], reddit, "Reddit", true)}
      ${ask(card.asks[1], x, "X", false)}
    </div>
  </body></html>`;
}

const scratch = mkdtempSync(join(tmpdir(), "radar-cards-"));
mkdirSync(join(out, "c"), { recursive: true });
for (const card of cards) {
  const page = join(scratch, "card.html");
  writeFileSync(page, html(card));
  const file = join(out, card.file);
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--allow-file-access-from-files",
      "--force-device-scale-factor=1",
      "--virtual-time-budget=3000",
      "--window-size=1200,630",
      `--screenshot=${file}`,
      pathToFileURL(page).href,
    ],
    { stdio: "ignore" },
  );
  console.log(card.file);
}
rmSync(scratch, { recursive: true, force: true });
