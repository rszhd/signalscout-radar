import { siteUrl } from "./links.ts";

/**
 * Where the links in an email point: production's address, or PUBLIC_URL for
 * a local run, so a test confirmation opens the local page.
 */
export function publicUrl(): string {
  return (process.env.PUBLIC_URL || siteUrl).replace(/\/$/, "");
}

/** The salt for the hashed IP that limits sign-ups; the address is never stored. */
export function ipSalt(): string {
  return process.env.RADAR_IP_SALT || "radar";
}

/**
 * Whether the site can send email. Without SMTP settings the form is not
 * shown, so a deploy before the box's .env has them shows the tags and
 * hides only the email (US-456).
 */
export function mailReady(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
