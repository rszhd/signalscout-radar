/**
 * Tags: what a seller sells, finer than a category. US-456.
 *
 * A category is too broad to follow: "Home office" holds desks, chairs and
 * mice, and the person who sells chairs wants the chairs. So each category
 * has its own closed list here, and the sort picks from it. A list and not
 * free tags, because a subscription needs a tag that keeps its name: free
 * tags drift ("crm", "CRM software", "crm-tool") and a subscriber to one
 * misses the others.
 *
 * The list grows by proposal. The model may name a tag that is not here; it
 * is stored hidden in the `tags` table and shown once enough posts carry it
 * (`proposalShownAt`). The same goes for "alternatives to <product>", the
 * product a buyer wants to leave.
 *
 * The slug is a URL and a subscription, so it never changes. The name may.
 */
import type { CategorySlug } from "./categories.ts";

export const listedTags: Partial<Record<CategorySlug, Record<string, string>>> = {
  // Software
  "sales-crm": {
    crm: "CRM",
    "lead-generation": "Lead generation and data",
    "sales-outreach": "Cold email and outreach",
    "linkedin-tools": "LinkedIn tools",
    "sales-call-tools": "Dialers and call coaching",
    "proposal-software": "Proposals, quotes and RFPs",
  },
  marketing: {
    "email-marketing": "Email marketing",
    "email-sending": "Transactional email",
    newsletters: "Newsletter platforms",
    "social-media-tools": "Social media scheduling and growth",
    "seo-tools": "SEO and AI-search tools",
    "competitor-tracking": "Competitor and market tracking",
    "website-builders": "Website builders",
    "link-in-bio": "Link in bio",
    analytics: "Web analytics",
    "ad-platforms": "Ad platforms",
  },
  finance: {
    invoicing: "Invoicing",
    accounting: "Accounting software",
    "budgeting-apps": "Budgeting and expense apps",
    "payment-processing": "Payment processing",
    "selling-digital-products": "Selling digital products",
    banking: "Banks and business accounts",
    "credit-cards": "Credit cards",
    insurance: "Insurance",
    "investing-platforms": "Investing and trading platforms",
    "trading-tools": "Trading tools and screeners",
    "prop-firms": "Prop trading firms",
    payroll: "Payroll",
  },
  productivity: {
    "note-taking": "Note-taking apps",
    "todo-apps": "To-do and reminder apps",
    calendars: "Calendars and planners",
    "booking-software": "Booking and appointments",
    "document-editors": "Docs, wikis and office suites",
    whiteboards: "Whiteboards",
    journaling: "Journaling",
    "habit-trackers": "Habit and focus apps",
    "read-later": "Bookmarks and read-later",
    browsers: "Browsers and extensions",
    "desktop-utilities": "Desktop utilities",
    "notebooks-stationery": "Notebooks and stationery",
  },
  "project-management": {
    "project-management-tools": "Project management tools",
    "time-tracking": "Time tracking",
    "team-chat": "Team chat",
    "client-portals": "Client portals",
  },
  design: {
    "graphic-design": "Graphic design tools",
    "photo-editing": "Photo editing",
    "drawing-apps": "Drawing and painting apps",
    "ai-image-generators": "AI image generators",
    "ui-design": "UI design tools",
    "3d-modelling": "3D modelling",
    animation: "Animation software",
    "art-supplies": "Art supplies and drawing tablets",
    portfolios: "Portfolio sites",
  },
  "video-audio": {
    "video-editing": "Video editing software",
    "ai-video-generators": "AI video generators",
    "screen-recording": "Screen and game recording",
    "live-streaming": "Live streaming software",
    "podcast-software": "Podcast recording and hosting",
    "music-production": "Music production (DAWs)",
    "music-distribution": "Music distribution",
    "stock-media": "Stock footage, music and assets",
    transcription: "Transcription",
    "audio-plugins": "Audio plugins and EQ",
  },
  "developer-ai": {
    "ai-assistants": "AI assistants and chatbots",
    "ai-coding": "AI coding tools",
    "local-llms": "Local and open AI models",
    "ai-apis": "AI APIs and model providers",
    hosting: "Hosting and VPS",
    databases: "Databases and backends",
    "dev-tools": "Developer tools and libraries",
    "no-code": "No-code and automation tools",
    "monitoring-tools": "Monitoring and alerts",
  },
  security: {
    "password-managers": "Password managers",
    vpn: "VPNs",
    "proxies-dns": "Proxies and DNS",
    "ad-blockers": "Ad blockers",
    antivirus: "Antivirus",
    backup: "Backup and recovery",
    "email-providers": "Private email and aliases",
    "parental-control": "Parental control",
    "security-cameras": "Security cameras and NVRs",
    "it-security-tools": "IT security and access management",
  },
  "work-platforms": {
    "freelance-marketplaces": "Freelance marketplaces",
    "job-boards": "Job boards",
    "selling-platforms": "Marketplaces to sell on",
    "hiring-software": "Hiring and applicant tracking",
  },
  "consumer-apps": {
    "music-players": "Music players and streaming",
    "reading-apps": "E-book and reading apps",
    "language-apps": "Language learning apps",
    "fitness-apps": "Fitness and health apps",
    "streaming-services": "Video streaming services",
    "travel-booking": "Travel and hotel booking",
    "android-apps": "Android customisation apps",
    "messaging-apps": "Messaging and call apps",
    "learning-apps": "Courses and study apps",
    "sports-apps": "Sports and betting apps",
  },
  // Things people buy
  computers: {
    laptops: "Laptops",
    "gaming-laptops": "Gaming laptops",
    "gaming-pcs": "Gaming PCs and builds",
    desktops: "Desktop PCs",
    "graphics-cards": "Graphics cards",
    "pc-parts": "PC parts",
    monitors: "Monitors",
    tablets: "Tablets and styluses",
    "e-readers": "E-readers",
    storage: "SSDs and drives",
    printers: "Printers",
  },
  phones: {
    phones: "Phones",
    smartwatches: "Smartwatches and smart rings",
    "fitness-trackers": "Fitness trackers",
    chargers: "Chargers and power banks",
    "phone-cases": "Cases and accessories",
  },
  audio: {
    headphones: "Headphones",
    earbuds: "Earbuds",
    "gaming-headsets": "Gaming headsets",
    speakers: "Speakers",
    subwoofers: "Subwoofers",
    amplifiers: "Amplifiers and AV receivers",
    "dacs-amps": "DACs and headphone amps",
    turntables: "Turntables and CD players",
    soundbars: "Soundbars and home cinema",
    microphones: "Microphones",
    "audio-interfaces": "Audio interfaces",
  },
  cameras: {
    cameras: "Mirrorless and DSLR cameras",
    lenses: "Lenses",
    "compact-cameras": "Compact cameras",
    "film-cameras": "Film and instant cameras",
    "action-cameras": "Action cameras",
    drones: "Drones",
    "camera-accessories": "Memory cards and camera accessories",
    lighting: "Lighting",
    webcams: "Webcams and capture cards",
  },
  "home-office": {
    "office-chairs": "Office chairs",
    "standing-desks": "Standing desks",
    desks: "Desks",
    keyboards: "Keyboards and keycaps",
    mice: "Mice and trackpads",
    "monitor-arms": "Monitor arms and mounts",
    "desk-accessories": "Desk mats and accessories",
    "docking-stations": "Docking stations",
  },
  "tools-electronics": {
    "power-tools": "Power tools",
    "hand-tools": "Hand tools",
    knives: "Knives and multitools",
    "3d-printers": "3D printers and filament",
    "cnc-lasers": "CNC routers and laser cutters",
    soldering: "Soldering",
    "electronic-parts": "Microcontrollers and electronic parts",
    "cables-networking": "Cables and networking",
    "tool-storage": "Tool storage",
  },
  "home-kitchen": {
    vacuums: "Vacuums and floor cleaners",
    tvs: "TVs",
    "coffee-machines": "Coffee machines and grinders",
    "kitchen-appliances": "Kitchen appliances",
    cookware: "Cookware and knives",
    "laundry-appliances": "Washing machines and dryers",
    "air-conditioning": "Air conditioners and heaters",
    "air-purifiers": "Air purifiers and dehumidifiers",
    mattresses: "Mattresses and beds",
    bedding: "Pillows, bedding and blankets",
    furniture: "Furniture",
    "smart-home": "Smart home",
    "grills-outdoor": "Grills and outdoor cooking",
    "garden-plants": "Garden and plants",
    "cleaning-products": "Cleaning products",
  },
  beauty: {
    skincare: "Skincare",
    sunscreen: "Sunscreen",
    haircare: "Hair products",
    "hair-tools": "Hair dryers and straighteners",
    "wigs-extensions": "Wigs and hair extensions",
    makeup: "Makeup",
    fragrance: "Fragrance",
    shaving: "Trimmers and shaving",
    "hair-removal": "Hair removal",
    "nail-care": "Nails",
    "oral-care": "Oral care",
  },
  fashion: {
    shoes: "Shoes and sneakers",
    boots: "Boots",
    watches: "Watches",
    jewellery: "Jewellery",
    bags: "Bags and wallets",
    luggage: "Luggage",
    jackets: "Jackets and coats",
    knitwear: "Sweaters and hoodies",
    "formal-wear": "Suits and formal wear",
    workwear: "Workwear",
    activewear: "Activewear",
    lingerie: "Bras and underwear",
    clothing: "Clothing",
    costumes: "Costumes",
  },
  "baby-kids": {
    "car-seats": "Car seats",
    strollers: "Strollers and carriers",
    "nursery-furniture": "Cots and play yards",
    "feeding-gear": "Bottles, pumps and formula",
    "baby-gear": "Baby essentials",
    toys: "Toys",
    collectibles: "Figures and collectibles",
    "kids-clothing": "Kids' clothing",
  },
  "cars-bikes": {
    cars: "New cars",
    "used-cars": "Used cars",
    "electric-cars": "Electric and hybrid cars",
    "e-bikes": "E-bikes",
    bicycles: "Bicycles",
    "bike-parts": "Bike parts and tyres",
    motorcycles: "Motorcycles and scooters",
    tyres: "Car tyres",
    "car-accessories": "Car accessories and parts",
    "dash-cams": "Dash cams",
    "car-buying-tools": "Car history and buying tools",
  },
  "sports-outdoors": {
    "running-shoes": "Running and trail shoes",
    "home-gym": "Home gym and walking pads",
    tents: "Tents",
    "sleeping-bags": "Sleeping bags and pads",
    "camping-gear": "Camping stoves, lanterns and coolers",
    hiking: "Hiking gear and boots",
    "winter-sports": "Skis and snowboards",
    climbing: "Climbing gear",
    "water-sports": "Kayaks, paddles and surf",
    "cycling-gear": "Cycling gear and helmets",
    "sports-shoes": "Court and gym shoes",
    "skate-scooters": "Skateboards and scooters",
  },
  gaming: {
    consoles: "Consoles and handhelds",
    games: "Games",
    "in-game-purchases": "In-game purchases",
    "trading-cards": "Trading card games",
    controllers: "Controllers and adapters",
    "gaming-mice": "Gaming mice",
    "gaming-chairs": "Gaming chairs",
    "vr-headsets": "VR headsets",
  },
  health: {
    supplements: "Supplements",
    protein: "Protein and sports nutrition",
    "health-wearables": "Health wearables",
    "health-devices": "Health devices",
    "braces-supports": "Compression, braces and supports",
    "sleep-aids": "Sleep aids",
    "eye-care": "Eye care",
    "health-apps": "Health and tracking apps",
  },
  pets: {
    "dog-food": "Dog food and treats",
    "cat-supplies": "Cat litter and supplies",
    "pet-gear": "Pet gear and feeders",
    aquariums: "Aquariums, fish and plants",
    reptiles: "Reptile and terrarium supplies",
    "small-pets": "Small pet supplies",
    "pet-health": "Pet health and flea care",
  },
  // Business services (US-429)
  "web-development": {
    websites: "Website building",
    "online-stores": "Online stores and Shopify",
    "app-development": "App development",
    "wordpress-help": "WordPress help",
    "bug-fixing": "Bug fixes and maintenance",
  },
  "ai-automation": {
    chatbots: "Chatbots",
    "ai-agents": "AI agents",
    "workflow-automation": "Workflow automation and integrations",
  },
  "marketing-services": {
    "seo-services": "SEO services",
    "paid-ads": "Paid ads management",
    "social-media-management": "Social media management",
    "email-campaigns": "Email campaigns",
    "growth-agencies": "Growth and lead generation agencies",
  },
  "design-services": {
    "logo-design": "Logo design",
    branding: "Branding",
    "ui-ux-design": "UI and UX design",
    illustration: "Illustration and art commissions",
    "pitch-decks": "Pitch decks and presentations",
  },
  "content-services": {
    copywriting: "Copywriting",
    ghostwriting: "Ghostwriting",
    "video-editing-services": "Video editors",
    translation: "Translation",
    "ugc-creators": "UGC and content creators",
  },
  "accounting-legal": {
    bookkeeping: "Bookkeeping",
    "tax-advice": "Tax advice",
    lawyers: "Lawyers",
    "company-formation": "Company formation",
  },
  "it-services": {
    "it-support": "IT support",
    "cloud-setup": "Cloud and server setup",
    "security-audits": "Security audits and compliance",
  },
  "virtual-assistants": {
    "virtual-assistant-services": "Virtual assistants",
    "data-entry": "Data entry",
    "customer-support-staff": "Customer support staff",
  },
  consulting: {
    "business-consultants": "Business consultants",
    "sales-consultants": "Sales and growth consultants",
    coaches: "Coaches",
    "fractional-executives": "Fractional executives",
  },
};

export interface ListedTag {
  readonly slug: string;
  readonly name: string;
  readonly category: CategorySlug;
}

export const listedTagRows: ListedTag[] = Object.entries(listedTags).flatMap(([category, tags]) =>
  Object.entries(tags ?? {}).map(([slug, name]) => ({ slug, name, category: category as CategorySlug })),
);

/** A proposal is shown once this many live posts carry it. */
export const proposalShownAt = 5;

/** The slug for a name the model wrote: "Standing Desks!" is standing-desks. */
export function tagSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

/** "alt-hubspot", from the product a buyer wants to leave. */
export function altSlug(product: string): string {
  const slug = tagSlug(product);
  return slug ? `alt-${slug}` : "";
}
