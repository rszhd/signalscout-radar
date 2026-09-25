/**
 * Every link from Radar to SignalScout, tagged, so the landing's Google
 * Analytics can tell a visit from Radar apart from any other.
 *
 * `medium` is where on Radar the link sat (the header, a category page's
 * pitch, an RSS item); `campaign` is the category, or "home".
 */
export function signalscoutUrl(medium: string, campaign = "home"): string {
  const url = new URL("https://www.signalscout.run/");
  url.searchParams.set("utm_source", "radar");
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

export const siteUrl = "https://radar.signalscout.run";
