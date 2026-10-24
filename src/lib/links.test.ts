import { describe, expect, it } from "vitest";
import { buyerfinderUrl } from "./links.ts";

describe("buyerfinderUrl", () => {
  it("tags a link with where it came from on Radar", () => {
    expect(buyerfinderUrl("pitch", "sales-crm")).toBe(
      "https://buyerfinder.run/?utm_source=radar&utm_medium=pitch&utm_campaign=sales-crm",
    );
  });
});
