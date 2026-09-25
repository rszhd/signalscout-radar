import { describe, expect, it } from "vitest";
import { excerptOf } from "./run.ts";

describe("excerptOf", () => {
  it("drops the handles a reply opens with", () => {
    expect(excerptOf("@nickgoff79 @other Any suggestions for a new app?")).toBe("Any suggestions for a new app?");
  });

  it("names nobody inside the text", () => {
    expect(excerptOf("Ask @janedoe or u/someuser which laptop")).toBe("Ask someone or someone which laptop");
  });

  it("keeps an email address whole", () => {
    expect(excerptOf("mail me at a@b.com")).toBe("mail me at a@b.com");
  });

  it("decodes X's entities and drops its short links", () => {
    expect(excerptOf('"big bad wolf" -&gt; any other ideas? https://t.co/nWAqmVPeMh')).toBe(
      '"big bad wolf" -> any other ideas?',
    );
  });

  it("cuts a long post at 280 characters with an ellipsis", () => {
    const out = excerptOf("word ".repeat(100));
    expect(out.length).toBeLessThanOrEqual(280);
    expect(out.endsWith("…")).toBe(true);
  });
});
