/**
 * Astro's cross-site form check, minus one path. US-456.
 *
 * A mail app's one-click unsubscribe (RFC 8058) is a form POST from the mail
 * provider's servers, with no Origin header, so Astro's own check refuses
 * it. That check is off in astro.config.mjs and done here instead, for every
 * path but /unsubscribe/<token>, where the token is the only key needed and
 * a forged request can do no more than the link itself.
 *
 * Before that, the Facebook groups' copy is read again when old (US-547).
 */
// The type, not `defineMiddleware` from the virtual "astro:middleware":
// CI type-checks before `astro build` writes the types that module needs.
import type { MiddlewareHandler } from "astro";
import { db } from "@/lib/db";
import { refreshKnownGroups } from "@/lib/known-groups.ts";
import { siteUrl } from "@/lib/links";

const formTypes = ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"];
const safe = ["GET", "HEAD", "OPTIONS"];

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { request, url } = context;
  // A page names each post's Facebook group from the table (US-547): the copy
  // is read again when a minute old. A failed read keeps the old copy.
  await refreshKnownGroups(db()).catch((error) => console.error("the known groups were not read", error));
  if (safe.includes(request.method) || url.pathname.startsWith("/unsubscribe/")) return next();
  const origin = request.headers.get("origin");
  const sameOrigin = origin === url.origin || origin === siteUrl;
  const type = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  const formLike = type === undefined || formTypes.includes(type);
  if (formLike && !sameOrigin) {
    return new Response(`Cross-site ${request.method} form submissions are forbidden`, { status: 403 });
  }
  return next();
};
