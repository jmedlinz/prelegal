import { describe, expect, it } from "vitest";
import { filledForm } from "@/test/fixtures";
import { buildCoverPage, buildNda, formatDate, initialFormData, pdfFilename } from "./build";
import type { Block, Inline, NdaFormData } from "./types";

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
const missingOf = (data: NdaFormData) =>
  runsOf(buildCoverPage(data))
    .filter((r) => r.kind === "missing")
    .map((r) => r.text);
const checkboxes = (data: NdaFormData) => buildCoverPage(data).flatMap((b) => (b.type === "checkbox" ? [b] : []));
const signatures = (data: NdaFormData) =>
  buildCoverPage(data).find((b): b is Extract<Block, { type: "signatures" }> => b.type === "signatures")!;

describe("initialFormData", () => {
  it("starts with the template defaults", () => {
    expect(initialFormData).toMatchObject({
      purpose: "Evaluating whether to enter into a business relationship with the other party.",
      effectiveDate: "",
      mndaTermType: "expires",
      mndaTermYears: "1",
      confidentialityType: "years",
      confidentialityYears: "1",
    });
  });

  it("gives each party its own object", () => {
    expect(initialFormData.parties[0]).not.toBe(initialFormData.parties[1]);
  });
});

describe("buildCoverPage", () => {
  it("follows the section order of the cover page template", () => {
    const headings = buildCoverPage(filledForm).flatMap((b) => (b.type === "heading" ? [b.text] : []));
    expect(headings).toEqual([
      "Mutual Non-Disclosure Agreement",
      "Using this Mutual Non-Disclosure Agreement",
      "Purpose",
      "Effective Date",
      "MNDA Term",
      "Term of Confidentiality",
      "Governing Law & Jurisdiction",
      "MNDA Modifications",
    ]);
  });

  it("fills in every value the user entered", () => {
    const text = textOf(buildCoverPage(filledForm));
    for (const expected of [
      "Evaluating a potential joint venture.",
      "October 11, 2026",
      "Expires 2 years from Effective Date.",
      "3 years from Effective Date, but in the case of trade secrets",
      "Governing Law: Delaware",
      "Jurisdiction: courts located in New Castle, DE",
      "Section 8 is deleted.",
    ]) {
      expect(text).toContain(expected);
    }
  });

  it("tags user-entered text as values", () => {
    const values = runsOf(buildCoverPage(filledForm))
      .filter((r) => r.kind === "value")
      .map((r) => r.text);
    expect(values).toEqual(expect.arrayContaining(["Delaware", "October 11, 2026", "2 years", "Ada Lovelace"]));
  });

  it("trims surrounding whitespace from entered values", () => {
    const text = textOf(buildCoverPage({ ...filledForm, governingLaw: "  Delaware \n" }));
    expect(text).toContain("Governing Law: Delaware\n");
  });

  describe("missing required fields", () => {
    it("shows a placeholder for every blank required field", () => {
      expect(missingOf({ ...initialFormData, purpose: "" })).toEqual([
        "[Purpose]",
        "[Effective Date]",
        "[Governing Law]",
        "[Jurisdiction]",
      ]);
    });

    it("treats whitespace-only input as blank", () => {
      expect(missingOf({ ...filledForm, purpose: " \n\t ", governingLaw: "   " })).toEqual([
        "[Purpose]",
        "[Governing Law]",
      ]);
    });

    it("has no placeholders once the form is complete", () => {
      expect(missingOf(filledForm)).toEqual([]);
    });

    it("never flags optional fields (modifications and party details)", () => {
      const data: NdaFormData = { ...filledForm, modifications: "", parties: initialFormData.parties };
      expect(missingOf(data)).toEqual([]);
    });
  });

  describe("MNDA term", () => {
    it("checks 'Expires' and shows the years when a fixed term is chosen", () => {
      const [expires, untilTerminated] = checkboxes(filledForm);
      expect(expires.checked).toBe(true);
      expect(untilTerminated.checked).toBe(false);
    });

    it("checks 'until terminated' and blanks the years when chosen", () => {
      const data: NdaFormData = { ...filledForm, mndaTermType: "untilTerminated" };
      const [expires, untilTerminated] = checkboxes(data);
      expect(expires.checked).toBe(false);
      expect(untilTerminated.checked).toBe(true);
      expect(expires.content.map((r) => r.text).join("")).toBe("Expires ____ year(s) from Effective Date.");
    });

    it("does not flag an invalid year count while the option is not selected", () => {
      expect(missingOf({ ...filledForm, mndaTermType: "untilTerminated", mndaTermYears: "" })).toEqual([]);
    });
  });

  describe("term of confidentiality", () => {
    it("checks the years option when chosen", () => {
      const [, , years, perpetual] = checkboxes(filledForm);
      expect(years.checked).toBe(true);
      expect(perpetual.checked).toBe(false);
    });

    it("checks 'In perpetuity' and blanks the years when chosen", () => {
      const data: NdaFormData = { ...filledForm, confidentialityType: "perpetual" };
      const [, , years, perpetual] = checkboxes(data);
      expect(years.checked).toBe(false);
      expect(perpetual.checked).toBe(true);
      expect(years.content[0].text).toBe("____ year(s)");
    });
  });

  describe("year counts", () => {
    it.each([
      ["1", "1 year"],
      ["2", "2 years"],
      ["10", "10 years"],
      ["007", "7 years"],
    ])("formats %j as %j", (raw, expected) => {
      expect(textOf(buildCoverPage({ ...filledForm, mndaTermYears: raw }))).toContain(`Expires ${expected} from`);
    });

    it.each(["", "0", "-1", "1.5", "abc", " "])("flags %j as missing", (raw) => {
      expect(missingOf({ ...filledForm, mndaTermYears: raw, confidentialityYears: raw })).toEqual([
        "[number of years]",
        "[number of years]",
      ]);
    });
  });

  describe("modifications", () => {
    it("shows 'None.' when blank", () => {
      expect(textOf(buildCoverPage({ ...filledForm, modifications: "  " }))).toContain("None.");
      expect(textOf(buildCoverPage(filledForm))).not.toContain("None.");
    });

    it("keeps line breaks in multi-line modifications", () => {
      const text = textOf(buildCoverPage({ ...filledForm, modifications: "Line one.\nLine two." }));
      expect(text).toContain("Line one.\nLine two.");
    });
  });

  describe("signature table", () => {
    it("has the template's rows in order, with signatures and dates left blank", () => {
      const block = signatures(filledForm);
      expect(block.statement).toBe(
        "By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.",
      );
      expect(block.rows.map((r) => r.label)).toEqual([
        "Signature",
        "Print Name",
        "Title",
        "Company",
        "Notice Address",
        "Date",
      ]);
      for (const label of ["Signature", "Date"]) {
        expect(block.rows.find((r) => r.label === label)!.values.map((v) => v.text)).toEqual(["", ""]);
      }
    });

    it("puts each party's details in its own column", () => {
      const rows = Object.fromEntries(signatures(filledForm).rows.map((r) => [r.label, r.values.map((v) => v.text)]));
      expect(rows["Print Name"]).toEqual(["Ada Lovelace", "Alan Turing"]);
      expect(rows["Title"]).toEqual(["CEO", "CTO"]);
      expect(rows["Company"]).toEqual(["Acme, Inc.", "Globex"]);
      expect(rows["Notice Address"]).toEqual(["ada@acme.test", "1 Main St\nSpringfield, IL"]);
    });

    it("keeps the notice-address hint from the template", () => {
      expect(signatures(filledForm).rows.find((r) => r.label === "Notice Address")!.hint).toBe(
        "Use either email or postal address",
      );
    });
  });

  it("links to the Standard Terms and keeps the CC BY 4.0 attribution", () => {
    const links = runsOf(buildCoverPage(filledForm)).filter((r) => r.href);
    expect(links).toEqual([
      { text: "commonpaper.com/standards/mutual-nda/1.0", href: "https://commonpaper.com/standards/mutual-nda/1.0" },
      { text: "CC BY 4.0", href: "https://creativecommons.org/licenses/by/4.0/" },
    ]);
  });

  it("does not mutate the form data", () => {
    const data = structuredClone(filledForm);
    buildCoverPage(data);
    expect(data).toEqual(filledForm);
  });
});

describe("buildNda", () => {
  it("puts the Standard Terms after the Cover Page on a new page", () => {
    const terms: Block[] = [{ type: "heading", level: 1, text: "Standard Terms" }];
    const doc = buildNda(filledForm, terms);
    expect(doc.slice(0, -2)).toEqual(buildCoverPage(filledForm));
    expect(doc.at(-2)).toEqual({ type: "pageBreak" });
    expect(doc.at(-1)).toBe(terms[0]);
  });
});

describe("formatDate", () => {
  it.each([
    ["2026-10-11", "October 11, 2026"],
    ["2026-01-01", "January 1, 2026"],
    ["2026-12-31", "December 31, 2026"],
    ["2028-02-29", "February 29, 2028"],
    ["0002-10-11", "October 11, 2"],
    ["0099-06-15", "June 15, 99"],
  ])("formats %s as %s", (iso, expected) => {
    expect(formatDate(iso)).toBe(expected);
  });

  it.each(["", "abc", "2026-xx-01"])("returns null for %j", (iso) => {
    expect(formatDate(iso)).toBeNull();
  });
});

describe("pdfFilename", () => {
  it("names the file after both companies", () => {
    expect(pdfFilename(filledForm)).toBe("Mutual-NDA-Acme-Inc-Globex.pdf");
  });

  it("falls back to a generic name when no companies are entered", () => {
    expect(pdfFilename(initialFormData)).toBe("Mutual-NDA.pdf");
  });

  it("uses whichever company is entered", () => {
    const parties: NdaFormData["parties"] = [initialFormData.parties[0], { ...filledForm.parties[1] }];
    expect(pdfFilename({ ...initialFormData, parties })).toBe("Mutual-NDA-Globex.pdf");
  });

  it("strips characters that are unsafe in filenames", () => {
    const parties: NdaFormData["parties"] = [
      { ...filledForm.parties[0], company: '  A/B\\C:*?"<>| Co.  ' },
      { ...filledForm.parties[1], company: "&&&" },
    ];
    expect(pdfFilename({ ...filledForm, parties })).toBe("Mutual-NDA-A-B-C-Co.pdf");
  });
});
