import { timingSafeEqual } from "node:crypto";

/** Whether an `Authorization` header carries this token. An unset token matches nothing. */
export function bearerMatches(header: string | null, token: string | undefined): boolean {
  if (!token || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const wanted = Buffer.from(token);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
