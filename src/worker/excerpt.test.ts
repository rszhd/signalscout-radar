import { describe, expect, it } from "vitest";
import { excerptOf } from "./run.ts";

describe("excerptOf", () => {
  it("drops the handles a reply opens with", () => {
    expect(excerptOf("@nickgoff79 @other Any suggestions for a new app?")).toBe("Any suggestions for a new app?");
  });

  it("names nobody inside the text", () => {
    expect(excerptOf("Ask @janedoe or u/someuser which laptop")).toBe("Ask someone or someone which laptop");
  });

  // An email was kept whole until US-429; now it is dropped like any contact.
  it("drops an email address whole, not as a handle", () => {
    expect(excerptOf("mail me at a@b.com")).toBe("mail me at [email]");
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

  it("drops the contact details a hiring post carries", () => {
    expect(
      excerptOf(
        "Email me at jane.doe@studio.co or call +1 (415) 555-0132, discord: jane#1234, https://t.me/janedoe",
      ),
    ).toBe("Email me at [email] or call [phone], discord: [handle], [contact link]");
  });

  it("keeps a price or a year that is not a phone number", () => {
    expect(excerptOf("Budget $1,500 for 2026, 3 pages")).toBe("Budget $1,500 for 2026, 3 pages");
  });
});
