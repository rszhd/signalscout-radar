/**
 * Radar's two emails: the confirmation and the daily list. US-456.
 *
 * The reader is a seller, so the daily email is a list of buyers to answer,
 * not a newsletter: each post leads with what the buyer wants, and links to
 * the post while it is fresh enough to answer.
 */
// Not present.ts: it imports through the "@/" alias, which the worker's
// plain Node cannot resolve.
import { signalscoutUrl } from "./links.ts";

export interface Email {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const ink = "#1f1f1f";
const muted = "#5f6368";
const line = "#e3e3e3";
const brand = "#0b57d0";

function shell(body: string, footer: string): string {
  // The charset, so a reader that ignores the MIME header still shows "·".
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f8f9fa;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:${ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${line};border-radius:14px">
<tr><td style="padding:20px 24px 0;font-weight:700;font-size:16px">SignalScout <span style="color:${brand}">Radar</span></td></tr>
<tr><td style="padding:12px 24px 24px;font-size:15px;line-height:1.55">${body}</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid ${line};font-size:12px;line-height:1.6;color:${muted}">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${brand};color:#ffffff;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:999px">${escapeHtml(label)}</a>`;
}

/** "Standing desks, Office chairs and Monitor arms". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** "Standing desks, Office chairs and 3 more", for a subject line. */
function shortList(names: readonly string[], room = 2): string {
  if (names.length <= room + 1) return listNames(names);
  return `${names.slice(0, room).join(", ")} and ${names.length - room} more`;
}

export function confirmationEmail(input: { tagNames: string[]; adding: boolean; confirmUrl: string }): Email {
  const tags = listNames(input.tagNames);
  const subject = input.adding ? `Confirm: add ${shortList(input.tagNames)} to your Radar email` : "Confirm your daily Radar email";
  const ask = input.adding
    ? `Click the link to add ${tags} to your daily Radar email:`
    : `Click the link to get a daily email with new posts from people asking for ${tags}:`;
  const ignore = "If you didn't ask for this, ignore this email. We won't send anything else.";
  const text = [ask, "", input.confirmUrl, "", ignore].join("\n");
  const html = shell(
    `<p style="margin:0 0 16px">${
      input.adding
        ? `Click the button to add <strong>${escapeHtml(tags)}</strong> to your daily Radar email.`
        : `Click the button to get a daily email with new posts from people asking for <strong>${escapeHtml(tags)}</strong>.`
    }</p>
<p style="margin:0 0 16px">${button(input.confirmUrl, input.adding ? "Add these tags" : "Start my daily email")}</p>`,
    ignore,
  );
  return { subject, text, html };
}

export interface DigestPost {
  platform: "reddit" | "x";
  channel: string | null;
  url: string;
  wants: string;
  excerpt: string;
  postedAt: Date;
  /** The subscriber's own tags this post carries, by name. */
  tagNames: string[];
}

function where(post: Pick<DigestPost, "platform" | "channel">): string {
  if (post.platform === "reddit" && post.channel) return `r/${post.channel.replace(/^r\//, "")}`;
  return post.platform === "x" ? "X" : "Reddit";
}

/** As the page says it: "40 min ago", "3 h ago", "2 d ago". */
function formatAge(from: Date, now: Date): string {
  const minutes = Math.max(1, Math.round((now.getTime() - from.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

const squeeze = (text: string) => text.replace(/\s+/g, " ").trim();
const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export function digestEmail(input: {
  posts: DigestPost[];
  /** Posts found for this subscriber beyond the ones in the email. */
  more: number;
  tagNames: string[];
  manageUrl: string;
  unsubscribeUrl: string;
  now?: Date;
}): Email {
  const now = input.now ?? new Date();
  const count = input.posts.length + input.more;
  const people = count === 1 ? "1 person is asking" : `${count} people are asking`;
  const subject = `${people} for ${shortList(input.tagNames)}`;
  const pitchUrl = signalscoutUrl("email", "digest");
  const pitch = "Want the posts that ask for your own product, as they appear? SignalScout watches for them.";
  const moreLine = input.more > 0 ? `And ${input.more} more. Pick fewer tags to see them all here.` : "";

  const text = [
    `${people} for ${listNames(input.tagNames)} since the last email.`,
    "",
    ...input.posts.flatMap((post) => [
      `${listNames(post.tagNames)} · ${where(post)} · ${formatAge(post.postedAt, now)}`,
      `Wants: ${squeeze(post.wants)}`,
      cut(squeeze(post.excerpt), 280),
      post.url,
      "",
    ]),
    ...(moreLine ? [moreLine, ""] : []),
    `${pitch} ${pitchUrl}`,
    "",
    `Change your tags: ${input.manageUrl}`,
    `Stop these emails: ${input.unsubscribeUrl}`,
  ].join("\n");

  const rows = input.posts
    .map(
      (post) => `<tr><td style="padding:0 0 18px"><div style="border-left:3px solid ${brand};padding-left:12px">
<div style="font-size:12px;color:${muted}">${escapeHtml(listNames(post.tagNames))} · ${escapeHtml(where(post))} · ${escapeHtml(formatAge(post.postedAt, now))}</div>
<div style="margin:2px 0;font-weight:600">${escapeHtml(squeeze(post.wants))}</div>
<div style="margin:0 0 4px;color:${muted};font-size:14px">${escapeHtml(cut(squeeze(post.excerpt), 280))}</div>
<a href="${escapeHtml(post.url)}" style="color:${brand};font-weight:600;font-size:14px">Open the post</a></div></td></tr>`,
    )
    .join("");

  const html = shell(
    `<p style="margin:0 0 18px">${escapeHtml(people)} for <strong>${escapeHtml(listNames(input.tagNames))}</strong> since the last email.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
${moreLine ? `<p style="margin:0 0 16px;color:${muted}">${escapeHtml(moreLine)}</p>` : ""}
<p style="margin:8px 0 0;padding-top:14px;border-top:1px solid ${line};font-size:14px;color:${muted}">${escapeHtml(pitch.replace(" SignalScout watches for them.", ""))} <a href="${escapeHtml(pitchUrl)}" style="color:${ink};font-weight:600">SignalScout</a> watches for them.</p>`,
    `<a href="${escapeHtml(input.manageUrl)}" style="color:${muted}">Change your tags</a> · <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:${muted}">Stop these emails</a>`,
  );
  return { subject, text, html };
}
