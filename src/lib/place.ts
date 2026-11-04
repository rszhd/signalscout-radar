import { groupName } from "./known-groups.ts";

/**
 * Where a post was found, as a reader sees it: "r/sysadmin", "head-fi.org",
 * a Facebook group's name (US-518), or the platform's name when there is no
 * channel. US-511.
 */
export function placeOf(platform: "reddit" | "x" | "forum" | "facebook", channel: string | null | undefined): string {
  if (platform === "reddit") return channel ? `r/${channel.replace(/^r\//, "")}` : "Reddit";
  if (platform === "forum") return channel ? channel.replace(/^www\./, "") : "A forum";
  if (platform === "facebook") return groupName(channel);
  return "X";
}
