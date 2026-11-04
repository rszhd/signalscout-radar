import { describe, expect, it } from "vitest";
import { loggingFetch } from "./facebook-log.ts";

const address = "https://api.scrapecreators.com/v1/facebook/group/posts?url=https%3A%2F%2Fwww.facebook.com%2Fgroups%2Fabc%2F";

describe("loggingFetch (US-518)", () => {
  it("logs a page's posts and leaves the answer readable for the connector", async () => {
    const lines: string[] = [];
    const body = { posts: [{ text: "hi", publishTime: 1_762_272_000 }, { text: "", publishTime: 1_762_200_000 }, { text: "x" }] };
    const fetch = loggingFetch(async () => new Response(JSON.stringify(body), { status: 200 }), (line) => lines.push(line));
    const response = await fetch(address);
    expect(await response.json()).toEqual(body);
    expect(lines).toEqual([
      "facebook page https://www.facebook.com/groups/abc/: HTTP 200, 3 posts, 1 with no text, 1 with no time, newest 2025-11-04T16:00:00.000Z, oldest 2025-11-03T20:00:00.000Z",
    ]);
  });

  it("logs an answer that is not JSON and still returns it", async () => {
    const lines: string[] = [];
    const fetch = loggingFetch(async () => new Response("Internal Server Error", { status: 500 }), (line) => lines.push(line));
    expect((await fetch(address)).status).toBe(500);
    expect(lines[0]).toMatch(/^facebook page https:\/\/www.facebook.com\/groups\/abc\/: HTTP 500, not JSON/);
  });
});
