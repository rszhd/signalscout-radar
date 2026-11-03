/**
 * Where a post was found, as a reader sees it: "r/sysadmin", "head-fi.org",
 * or the platform's name when there is no channel. US-511.
 */
export function placeOf(platform: "reddit" | "x" | "forum", channel: string | null | undefined): string {
  if (platform === "reddit") return channel ? `r/${channel.replace(/^r\//, "")}` : "Reddit";
  if (platform === "forum") return channel ? channel.replace(/^www\./, "") : "A forum";
  return "X";
}
