/**
 * Every link from Radar to BuyerFinder, tagged, so a visit from Radar can be
 * told apart from any other.
 *
 * `medium` is where on Radar the link sat (the header, a category page's
 * pitch, an RSS item); `campaign` is the category, or "home".
 */
export function buyerfinderUrl(medium: string, campaign = "home"): string {
  const url = new URL("https://buyerfinder.run/");
  url.searchParams.set("utm_source", "radar");
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

export const siteUrl = "https://radar.buyerfinder.run";
