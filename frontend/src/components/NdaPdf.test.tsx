import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { buildNda, initialFormData } from "../lib/nda/build";
import { loadStandardTerms } from "../lib/nda/templates";
import { NdaPdfDocument } from "./NdaPdf";

describe("NdaPdfDocument", () => {
  it("renders the full NDA to a multi-page PDF", async () => {
    const nda = buildNda(initialFormData, await loadStandardTerms());
    const buffer = await renderToBuffer(<NdaPdfDocument nda={nda} />);

    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = buffer.toString("latin1").match(/\/Type \/Page\b/g) ?? [];
    expect(pages.length).toBeGreaterThanOrEqual(2);
  });
});
