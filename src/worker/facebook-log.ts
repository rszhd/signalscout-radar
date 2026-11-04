/**
 * A fetch that logs one line per Facebook page, before the connector drops
 * posts with no text or older than the plan's look-back. On the box most
 * groups gave 0 posts while the same groups read from a laptop gave 3 or 4
 * (2026-11-05, US-518). Remove once the cause is known.
 */
type Fetch = typeof globalThis.fetch;

export function loggingFetch(inner: Fetch, log: (line: string) => void): Fetch {
  return async (input, init) => {
    const response = await inner(input, init);
    const group = new URL(String(input)).searchParams.get("url") ?? "?";
    try {
      const body = (await response.clone().json()) as { posts?: { text?: string | null; publishTime?: number }[] };
      const posts = body.posts ?? [];
      const times = posts.map((post) => post.publishTime).filter((time): time is number => typeof time === "number");
      const iso = (seconds: number | undefined) => (seconds === undefined ? "-" : new Date(seconds * 1000).toISOString());
      log(
        `facebook page ${group}: HTTP ${response.status}, ${posts.length} posts, ` +
          `${posts.filter((post) => !post.text).length} with no text, ${posts.length - times.length} with no time, ` +
          `newest ${iso(times.length ? Math.max(...times) : undefined)}, oldest ${iso(times.length ? Math.min(...times) : undefined)}`,
      );
    } catch (error) {
      log(`facebook page ${group}: HTTP ${response.status}, not JSON: ${(error as Error).message}`);
    }
    return response;
  };
}
