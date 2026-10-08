import type { APIRoute } from "astro";
import { z } from "zod";
import { onlyShown, shownTags } from "@/db/tags.ts";
import { db } from "@/lib/db";
import { confirmationEmail } from "@/lib/email.ts";
import { createMailer } from "@/lib/mail.ts";
import { ipSalt, json, publicUrl } from "@/lib/site.ts";
import { clientIp, hashIp, markConfirmationSent, maxTags, subscribe } from "@/lib/subscribers.ts";

const body = z.object({
  email: z.email().max(254),
  tags: z.array(z.string().max(64)).min(1).max(maxTags),
});

/** Ask for tags by email: store the request and send the confirmation link. US-456. */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return json({ message: field === "tags" ? "Pick at least one tag." : "Please enter a full email address." }, 400);
  }

  const send = createMailer();
  if (!send) return json({ message: "Email isn't available right now." }, 503);

  const sql = db();
  const tags = await onlyShown(sql, parsed.data.tags);
  if (tags.length === 0) return json({ message: "Pick at least one tag." }, 400);

  const ip = clientIp(request.headers.get("x-forwarded-for"), clientAddress);
  const result = await subscribe(sql, { email: parsed.data.email, tags, ipHash: hashIp(ip, ipSalt()) });

  if (result.status === "refused") return json({ message: result.reason }, 429);
  if (result.status === "already") return json({ status: "already" });
  // A confirmation went out a few minutes ago; say the same thing again.
  if (result.status === "wait") return json({ status: "sent" });

  const names = new Map((await shownTags(sql)).map((tag) => [tag.slug, tag.name]));
  const email = confirmationEmail({
    tagNames: result.tags.map((slug) => names.get(slug) ?? slug),
    adding: result.adding,
    confirmUrl: `${publicUrl()}/confirm/${result.token}`,
  });
  try {
    await send({ to: parsed.data.email, ...email, id: `radar-confirm-${result.subscriberId}-${Date.now()}` });
  } catch (error) {
    // The request is kept and no confirmation is marked sent, so asking
    // again sends one.
    console.error("the confirmation email could not be sent", error);
    return json({ message: "We couldn't send the email right now. Please try again later." }, 502);
  }
  await markConfirmationSent(sql, result.subscriberId);
  return json({ status: "sent" });
};
