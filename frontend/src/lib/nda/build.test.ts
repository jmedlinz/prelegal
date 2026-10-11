import { describe, expect, it } from "vitest";
import { buildCoverPage, buildNda, formatDate, initialFormData, pdfFilename } from "./build";
import { parseInline } from "./markdown";
import { loadStandardTerms } from "./templates";
import type { Block, Inline, NdaFormData } from "./types";

const filled: NdaFormData = {
  ...initialFormData,
  effectiveDate: "2026-10-11",
  mndaTermYears: "2",
  confidentialityYears: "3",
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  parties: [
    { name: "Ada Lovelace", title: "CEO", company: "Acme, Inc.", noticeAddress: "ada@acme.test" },
    { name: "Alan Turing", title: "CTO", company: "Globex", noticeAddress: "alan@globex.test" },
  ],
};

const runsByBlock = (blocks: Block[]): Inline[][] =>
  blocks.flatMap((b) => {
    if (b.type === "paragraph" || b.type === "checkbox") return [b.content];
    if (b.type === "signatures") return b.rows.map((r) => r.values);
    return [];
  });
const runsOf = (blocks: Block[]) => runsByBlock(blocks).flat();
const textOf = (blocks: Block[]) =>
  runsByBlock(blocks)
    .map((runs) => runs.map((r) => r.text).join(""))
    .join("\n");

describe("parseInline", () => {
  it("parses bold, links and cover page references", () => {
    expect(
      parseInline('the **MNDA** at [site](https://x.test) for the <span class="coverpage_link">Purpose</span>.'),
    ).toEqual([
      { text: "the " },
      { text: "MNDA", bold: true },
      { text: " at " },
      { text: "site", href: "https://x.test" },
      { text: " for the " },
      { text: "Purpose", kind: "ref" },
      { text: "." },
    ]);
  });
});

describe("loadStandardTerms", () => {
  it("parses the template into a heading, 11 numbered sections and the attribution", async () => {
    const blocks = await loadStandardTerms();
    expect(blocks[0]).toEqual({ type: "heading", level: 1, text: "Standard Terms" });

    const numbered = blocks.filter((b) => b.type === "paragraph" && b.number);
    expect(numbered).toHaveLength(11);

    const text = textOf(blocks);
    expect(text).not.toContain("<span");
    expect(text).not.toContain("**");
    expect(blocks.at(-1)).toMatchObject({
      content: expect.arrayContaining([{ text: "CC BY 4.0", href: "https://creativecommons.org/licenses/by/4.0/" }]),
    });
  });
});

describe("buildCoverPage", () => {
  it("fills in the user's values", () => {
    const text = textOf(buildCoverPage(filled));
    for (const expected of [
      "October 11, 2026",
      "2 years",
      "3 years",
      "Delaware",
      "courts located in New Castle, DE",
      "Acme, Inc.",
      "Alan Turing",
    ]) {
      expect(text).toContain(expected);
    }
  });

  it("marks blank required fields as missing placeholders", () => {
    const missing = runsOf(buildCoverPage({ ...initialFormData, purpose: "  " }))
      .filter((r) => r.kind === "missing")
      .map((r) => r.text);
    expect(missing).toEqual(["[Purpose]", "[Effective Date]", "[Governing Law]", "[Jurisdiction]"]);
  });

  it("checks the selected term options", () => {
    const checks = (data: NdaFormData) =>
      buildCoverPage(data).flatMap((b) => (b.type === "checkbox" ? [b.checked] : []));

    expect(checks(filled)).toEqual([true, false, true, false]);
    expect(checks({ ...filled, mndaTermType: "untilTerminated", confidentialityType: "perpetual" })).toEqual([
      false,
      true,
      false,
      true,
    ]);
  });

  it("uses the singular for one year and flags invalid year counts", () => {
    expect(textOf(buildCoverPage(initialFormData))).toContain("1 year from Effective Date");
    const runs = runsOf(buildCoverPage({ ...filled, mndaTermYears: "0", confidentialityYears: "1.5" }));
    expect(runs.filter((r) => r.text === "[number of years]")).toHaveLength(2);
  });

  it("shows 'None.' when there are no modifications", () => {
    expect(textOf(buildCoverPage(filled))).toContain("None.");
    expect(textOf(buildCoverPage({ ...filled, modifications: "Section 5 is deleted." }))).toContain(
      "Section 5 is deleted.",
    );
  });
});

describe("buildNda", () => {
  it("puts the Standard Terms after the Cover Page on a new page", () => {
    const terms: Block[] = [{ type: "heading", level: 1, text: "Standard Terms" }];
    const doc = buildNda(filled, terms);
    expect(doc.at(-2)).toEqual({ type: "pageBreak" });
    expect(doc.at(-1)).toBe(terms[0]);
  });
});

describe("helpers", () => {
  it("formats ISO dates without timezone drift", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
    expect(formatDate("0002-10-11")).toBe("October 11, 2");
    expect(formatDate("")).toBeNull();
  });

  it("builds a filename from the company names", () => {
    expect(pdfFilename(filled)).toBe("Mutual-NDA-Acme-Inc-Globex.pdf");
    expect(pdfFilename(initialFormData)).toBe("Mutual-NDA.pdf");
  });
});
