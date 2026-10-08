/**
 * Sending mail over SMTP. US-456.
 *
 * Radar uses the engine and not the pipeline, so this is its own small
 * transport, with the same SMTP_* settings as the other stacks on the box.
 * Resend is reached on port 2465 there: the box blocks 465 and 587.
 */
import nodemailer from "nodemailer";
import { z } from "zod";

// A blank value in .env is unset, not zero or "": `SMTP_PORT=` would
// otherwise coerce to port 0.
const blank = (value: unknown) => (value === "" ? undefined : value);

export const mailEnvSchema = z.object({
  SMTP_HOST: z.preprocess(blank, z.string().min(1).optional()),
  SMTP_PORT: z.preprocess(blank, z.coerce.number().int().positive().default(2465)),
  SMTP_SECURE: z.preprocess(blank, z.enum(["true", "false"]).default("true")),
  SMTP_USER: z.preprocess(blank, z.string().optional()),
  SMTP_PASSWORD: z.preprocess(blank, z.string().optional()),
  SMTP_FROM: z.preprocess(blank, z.string().min(3).optional()),
});

export interface Message {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** For `Message-ID`, so a retry of the same email is one message. */
  id: string;
  /** Every email after the confirmation: one click stops them (RFC 8058). */
  unsubscribeUrl?: string;
}

export type Send = (message: Message) => Promise<void>;

/** A sender, or null when SMTP is not set up. */
export function createMailer(environment: NodeJS.ProcessEnv = process.env): Send | null {
  const env = mailEnvSchema.parse(environment);
  if (!env.SMTP_HOST || !env.SMTP_FROM) return null;
  const secure = env.SMTP_SECURE === "true";
  // A local mail catcher (Mailpit) speaks plain SMTP; everything else must
  // use TLS.
  const local = env.SMTP_HOST === "localhost" || env.SMTP_HOST === "127.0.0.1";
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure,
    requireTLS: !secure && !local,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  const from = env.SMTP_FROM;

  return async (message) => {
    const result = await transport.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      messageId: `<${message.id}@radar.signalscout.run>`,
      ...(message.unsubscribeUrl
        ? {
            headers: {
              "List-Unsubscribe": `<${message.unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }
        : {}),
    });
    if (!result.accepted?.length || result.rejected?.length) throw new Error("the recipient was rejected");
  };
}
