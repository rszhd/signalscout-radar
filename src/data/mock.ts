/**
 * Sample data for the mockups. Invented posts, no real authors. US-416
 * replaces this with the table US-415 writes.
 */

export type Platform = "reddit" | "x" | "linkedin" | "youtube" | "tiktok" | "instagram";

export interface Category {
  readonly slug: string;
  readonly name: string;
  /** "software" or "things people buy", so the index can group them. */
  readonly kind: "software" | "goods";
  /** Requests in the last 7 days. */
  readonly week: number;
  /** Change against the week before, in per cent. */
  readonly trend: number;
}

export interface Request {
  readonly id: string;
  readonly platform: Platform;
  /** The subreddit on Reddit; absent elsewhere. */
  readonly channel?: string;
  /** On YouTube, TikTok and Instagram the request is a comment: the video it sits under. */
  readonly under?: string;
  readonly title?: string;
  readonly excerpt: string;
  /** One line the model writes: what the person wants. */
  readonly wants: string;
  readonly category: string;
  /** Minutes since it was posted. */
  readonly age: number;
  readonly url: string;
}

export const platforms: Record<Platform, { name: string; icon: string }> = {
  reddit: { name: "Reddit", icon: "/brands/reddit.png" },
  x: { name: "X", icon: "/brands/x.png" },
  linkedin: { name: "LinkedIn", icon: "/brands/linkedin.ico" },
  youtube: { name: "YouTube", icon: "/brands/youtube.png" },
  tiktok: { name: "TikTok", icon: "/brands/tiktok.png" },
  instagram: { name: "Instagram", icon: "/brands/instagram.png" },
};

export const categories: readonly Category[] = [
  { slug: "crm", name: "CRM", kind: "software", week: 86, trend: 12 },
  { slug: "invoicing", name: "Invoicing", kind: "software", week: 64, trend: 4 },
  { slug: "project-management", name: "Project management", kind: "software", week: 58, trend: -6 },
  { slug: "note-taking", name: "Note-taking", kind: "software", week: 51, trend: 18 },
  { slug: "email-marketing", name: "Email marketing", kind: "software", week: 44, trend: 2 },
  { slug: "password-managers", name: "Password managers", kind: "software", week: 29, trend: 31 },
  { slug: "web-hosting", name: "Web hosting", kind: "software", week: 27, trend: -3 },
  { slug: "scheduling", name: "Scheduling", kind: "software", week: 23, trend: 9 },
  { slug: "laptops", name: "Laptops", kind: "goods", week: 112, trend: 7 },
  { slug: "headphones", name: "Headphones", kind: "goods", week: 73, trend: -2 },
  { slug: "standing-desks", name: "Standing desks", kind: "goods", week: 38, trend: 15 },
  { slug: "keyboards", name: "Keyboards", kind: "goods", week: 35, trend: 5 },
  { slug: "cameras", name: "Cameras", kind: "goods", week: 31, trend: -8 },
  { slug: "office-chairs", name: "Office chairs", kind: "goods", week: 26, trend: 21 },
];

export const requests: readonly Request[] = [
  {
    id: "1",
    platform: "reddit",
    channel: "smallbusiness",
    title: "Simple CRM for a 3-person agency?",
    excerpt:
      "We track clients in a spreadsheet and it is falling apart. HubSpot feels like overkill. Can anyone recommend something simple that does follow-up reminders?",
    wants: "A simple CRM with follow-up reminders for a 3-person team",
    category: "crm",
    age: 12,
    url: "#",
  },
  {
    id: "2",
    platform: "x",
    excerpt:
      "What do you all use for invoicing as a freelancer? QuickBooks is way too much for one person.",
    wants: "Invoicing for a solo freelancer, lighter than QuickBooks",
    category: "invoicing",
    age: 19,
    url: "#",
  },
  {
    id: "3",
    platform: "reddit",
    channel: "SuggestALaptop",
    title: "Laptop for video editing under $1,500",
    excerpt:
      "Editing 4K footage in DaVinci Resolve. My budget is $1,500, and I would rather not buy a Mac. Which one should I buy?",
    wants: "A Windows laptop for 4K video editing, under $1,500",
    category: "laptops",
    age: 26,
    url: "#",
  },
  {
    id: "4",
    platform: "linkedin",
    excerpt:
      "Our team of 12 has outgrown Trello. Looking for recommendations on a project management tool that handles dependencies without a week of setup.",
    wants: "Project management with task dependencies for 12 people",
    category: "project-management",
    age: 34,
    url: "#",
  },
  {
    id: "5",
    platform: "youtube",
    under: "My 2026 note-taking setup",
    excerpt:
      "I have bounced between Notion and Obsidian for years. Can anyone recommend something local-first that syncs without a subscription?",
    wants: "Local-first note-taking with sync, no subscription",
    category: "note-taking",
    age: 41,
    url: "#",
  },
  {
    id: "6",
    platform: "tiktok",
    under: "Sony vs Bose, one month later",
    excerpt:
      "Sony or Bose? I sit next to the sales team all day. Comfort for 8 hours matters more than bass. Any suggestions?",
    wants: "Comfortable noise-cancelling headphones for all-day office use",
    category: "headphones",
    age: 48,
    url: "#",
  },
  {
    id: "7",
    platform: "x",
    excerpt:
      "Any good Mailchimp alternative? Their pricing jumped again and I only send one newsletter a week.",
    wants: "A cheaper Mailchimp alternative for a weekly newsletter",
    category: "email-marketing",
    age: 55,
    url: "#",
  },
  {
    id: "8",
    platform: "youtube",
    under: "Budget standing desk review",
    excerpt:
      "Looking at a few budget frames. Wobble at full height is my main worry. Does anyone own one they would buy again?",
    wants: "A budget standing desk that does not wobble at full height",
    category: "standing-desks",
    age: 63,
    url: "#",
  },
  {
    id: "9",
    platform: "linkedin",
    excerpt:
      "Can anyone recommend a password manager for a 40-person company? We need SSO and shared vaults, and our current one is being retired.",
    wants: "A team password manager with SSO for 40 people",
    category: "password-managers",
    age: 72,
    url: "#",
  },
  {
    id: "10",
    platform: "reddit",
    channel: "freelance",
    title: "Invoice app that chases late payments?",
    excerpt:
      "Half my clients pay 30 days late. Is there an invoicing app that sends the reminders for me so I do not have to?",
    wants: "Invoicing that sends automatic late-payment reminders",
    category: "invoicing",
    age: 88,
    url: "#",
  },
  {
    id: "11",
    platform: "reddit",
    channel: "selfhosted",
    title: "Which VPS host for a small side project?",
    excerpt:
      "Which VPS host do people trust for a small side project these days? Mostly need predictable pricing and a European region.",
    wants: "A VPS host with predictable pricing and an EU region",
    category: "web-hosting",
    age: 97,
    url: "#",
  },
  {
    id: "12",
    platform: "instagram",
    under: "Desk setup tour",
    excerpt: "Which mechanical keyboard should I buy for coding? Quiet switches, please, I share an office.",
    wants: "A quiet mechanical keyboard for programming",
    category: "keyboards",
    age: 110,
    url: "#",
  },
  {
    id: "13",
    platform: "reddit",
    channel: "sales",
    title: "CRM that works well with Gmail?",
    excerpt:
      "Everything I try wants me to live inside its app. I want to stay in Gmail and log emails to deals automatically. What do you all use?",
    wants: "A CRM that logs Gmail threads to deals automatically",
    category: "crm",
    age: 124,
    url: "#",
  },
  {
    id: "14",
    platform: "linkedin",
    excerpt:
      "Recommendations for a scheduling tool that handles round-robin across three sales reps? Calendly's team plan is more than we need.",
    wants: "Round-robin scheduling for three sales reps",
    category: "scheduling",
    age: 140,
    url: "#",
  },
];

export function categoryBySlug(slug: string): Category | undefined {
  return categories.find((category) => category.slug === slug);
}

export function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}
