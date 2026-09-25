import { connect, type Sql } from "@/db/client.ts";

let shared: Sql | undefined;

/** One pool for the web process, opened on the first request. */
export function db(): Sql {
  if (!shared) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    shared = connect(url);
  }
  return shared;
}
