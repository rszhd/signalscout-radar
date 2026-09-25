/**
 * The closed list a request is sorted into. US-414.
 *
 * Broad on purpose. US-413 measured roughly 600 requests a day at $2, spread
 * over everything people buy; a list as fine as "CRM" or "standing desks"
 * would leave most pages nearly empty, and an empty page is not worth
 * indexing. The list was drawn from what the US-413 requests actually asked
 * for, not written in advance.
 *
 * The slug is a URL and a database value, so it never changes. The name may.
 */
export const categories = [
  // Software
  { slug: "sales-crm", name: "Sales & CRM", kind: "software", covers: "CRMs, lead tracking, sales tools" },
  { slug: "marketing", name: "Marketing & email", kind: "software", covers: "newsletters, email marketing, social media and SEO tools" },
  { slug: "finance", name: "Finance & invoicing", kind: "software", covers: "invoicing, accounting, budgeting, payments, banking and trading apps" },
  { slug: "productivity", name: "Productivity & notes", kind: "software", covers: "note-taking, to-do lists, calendars, scheduling, docs, inspiration boards" },
  { slug: "project-management", name: "Project management", kind: "software", covers: "task boards, team planning, time tracking" },
  { slug: "design", name: "Design & creative", kind: "software", covers: "drawing, design, photo, icon and animation tools" },
  { slug: "video-audio", name: "Video & audio software", kind: "software", covers: "video editors, recording, podcasting and music production software" },
  { slug: "developer-ai", name: "Developer & AI tools", kind: "software", covers: "coding tools, APIs, AI models and assistants, databases, hosting" },
  { slug: "security", name: "Security & privacy", kind: "software", covers: "password managers, VPNs, antivirus, backups" },
  { slug: "work-platforms", name: "Freelance & hiring platforms", kind: "software", covers: "marketplaces to find clients or staff, job boards" },
  { slug: "consumer-apps", name: "Everyday apps", kind: "software", covers: "podcast, reading, streaming, fitness, travel, betting and other personal apps" },
  // Things people buy
  { slug: "computers", name: "Computers & tablets", kind: "goods", covers: "laptops, desktops, tablets, monitors, PC parts" },
  { slug: "phones", name: "Phones & wearables", kind: "goods", covers: "phones, smartwatches, chargers, cases" },
  { slug: "audio", name: "Headphones & audio", kind: "goods", covers: "headphones, earbuds, speakers, microphones" },
  { slug: "cameras", name: "Cameras & video gear", kind: "goods", covers: "cameras, lenses, lighting, streaming gear" },
  { slug: "home-office", name: "Home office", kind: "goods", covers: "desks, chairs, keyboards, mice, desk accessories" },
  { slug: "tools-electronics", name: "Tools & electronic parts", kind: "goods", covers: "hand and power tools, tool storage, components, 3D printers" },
  { slug: "home-kitchen", name: "Home & kitchen", kind: "goods", covers: "appliances, furniture, kitchenware, cleaning, garden" },
  { slug: "beauty", name: "Beauty & personal care", kind: "goods", covers: "skincare, haircare, makeup, grooming" },
  { slug: "fashion", name: "Clothing, watches & jewellery", kind: "goods", covers: "clothes, shoes, bags, watches, rings" },
  { slug: "baby-kids", name: "Baby & kids", kind: "goods", covers: "car seats, strollers, toys, school supplies" },
  { slug: "cars-bikes", name: "Cars & bikes", kind: "goods", covers: "cars, e-bikes, bicycles, car accessories, tyres" },
  { slug: "sports-outdoors", name: "Sports & outdoors", kind: "goods", covers: "fitness equipment, camping, running, cycling gear" },
  { slug: "gaming", name: "Gaming", kind: "goods", covers: "consoles, games, controllers, gaming accessories" },
  { slug: "health", name: "Health & supplements", kind: "goods", covers: "supplements, health devices, sleep aids" },
  { slug: "pets", name: "Pets", kind: "goods", covers: "pet food, pet gear, aquariums" },
] as const;

export type CategorySlug = (typeof categories)[number]["slug"];
export type CategoryKind = (typeof categories)[number]["kind"];

export const categorySlugs = categories.map((category) => category.slug) as [
  CategorySlug,
  ...CategorySlug[],
];

export function categoryBySlug(slug: string) {
  return categories.find((category) => category.slug === slug);
}
