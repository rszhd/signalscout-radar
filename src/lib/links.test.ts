import { describe, expect, it } from "vitest";
import { signalscoutUrl } from "./links.ts";

describe("signalscoutUrl", () => {
  it("tags a link with where it came from on Radar", () => {
    expect(signalscoutUrl("pitch", "sales-crm")).toBe(
      "https://www.signalscout.run/?utm_source=radar&utm_medium=pitch&utm_campaign=sales-crm",
    );
  });
});
