import { describe, expect, it } from "vitest";
import { loadStandardTerms } from "./templates";

describe("loadStandardTerms", () => {
  it("reads and parses templates/Mutual-NDA.md from the repo", async () => {
    const blocks = await loadStandardTerms();
    expect(blocks[0]).toEqual({ type: "heading", level: 1, text: "Standard Terms" });
    expect(blocks.filter((b) => b.type === "paragraph" && b.number)).toHaveLength(11);
  });
});
