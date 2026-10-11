import { renderToBuffer } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it } from "vitest";
import { buildNda, initialFormData } from "@/lib/nda/build";
import { loadStandardTerms } from "@/lib/nda/templates";
import type { Block, NdaFormData } from "@/lib/nda/types";
import { filledForm } from "@/test/fixtures";
import { readPdf } from "@/test/pdfText";
import { lineBreakParts, NdaPdfDocument } from "./NdaPdf";

let standardTerms: Block[];
beforeAll(async () => {
  standardTerms = await loadStandardTerms();
});

async function renderPages(data: NdaFormData) {
  const buffer = await renderToBuffer(<NdaPdfDocument nda={buildNda(data, standardTerms)} />);
  return { buffer, ...(await readPdf(new Uint8Array(buffer))) };
}

describe("NdaPdfDocument", () => {
  it("produces a valid PDF with document metadata", async () => {
    const { buffer, title } = await renderPages(filledForm);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(title).toBe("Mutual Non-Disclosure Agreement");
  });

  it("fits the filled-in Cover Page on page 1 and starts the Standard Terms on a new page", async () => {
    const { pages } = await renderPages(filledForm);
    expect(pages[0]).toContain("Mutual Non-Disclosure Agreement");
    expect(pages[0]).toContain("By signing this Cover Page");
    expect(pages[0]).not.toContain("Standard Terms 1.");
    expect(pages[1]).toMatch(/^Standard Terms 1\. Introduction/);
  });

  it("includes every user-entered value", async () => {
    const { pages } = await renderPages(filledForm);
    const coverPage = pages[0];
    for (const value of [
      "Evaluating a potential joint venture.",
      "October 11, 2026",
      "Expires 2 years from Effective Date.",
      "3 years from Effective Date",
      "Governing Law: Delaware",
      "Jurisdiction: courts located in New Castle, DE",
      "Section 8 is deleted.",
      "Ada Lovelace",
      "Alan Turing",
      "Acme, Inc.",
      "Globex",
      "ada@acme.test",
      "1 Main St",
      "Springfield, IL",
    ]) {
      expect(coverPage).toContain(value);
    }
  });

  it("marks the selected options with an X", async () => {
    const { pages } = await renderPages({
      ...filledForm,
      mndaTermType: "untilTerminated",
      confidentialityType: "perpetual",
    });
    expect(pages[0]).toContain("Expires ____ year(s) from Effective Date.");
    expect(pages[0]).toContain("X Continues until terminated");
    expect(pages[0]).toContain("X In perpetuity.");
  });

  it("keeps bracketed placeholders for blank required fields so they can be filled by hand", async () => {
    const { pages } = await renderPages(initialFormData);
    for (const placeholder of ["[Effective Date]", "[Governing Law]", "[Jurisdiction]"]) {
      expect(pages[0]).toContain(placeholder);
    }
  });

  it("includes all 11 sections of the Standard Terms and both attributions", async () => {
    const all = (await renderPages(filledForm)).pages.join(" ");
    for (let n = 1; n <= 11; n++) expect(all).toContain(`${n}. `);
    expect(all).toContain("11. General.");
    expect(all).toContain("Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use under CC BY 4.0.");
    expect(all).toContain("Common Paper Mutual Non-Disclosure Agreement Version 1.0 free to use under CC BY 4.0.");
  });

  it("never hyphenates words or URLs across lines", async () => {
    const { pages } = await renderPages(filledForm);
    expect(pages[0]).toContain("commonpaper.com/standards/mutual-nda/1.0");
    expect(pages.join(" ")).not.toMatch(/[a-z]- [a-z]/);
  });

  it("wraps long unbroken input inside the margins without inserting hyphens", async () => {
    const company = "Supercalifragilistic-Holdings-International-Incorporated-Limited-LLC";
    const email = `${"very".repeat(20)}@an-extremely-long-domain-name.test`;
    const parties: NdaFormData["parties"] = [
      { ...filledForm.parties[0], company },
      { ...filledForm.parties[1], noticeAddress: email },
    ];
    const { pages, rightEdges, pageWidth } = await renderPages({
      ...filledForm,
      modifications: "x".repeat(300),
      parties,
    });

    const rightMargin = 64;
    rightEdges.forEach((edge) => expect(edge).toBeLessThanOrEqual(pageWidth - rightMargin + 1));
    const text = pages.join("").replace(/\s+/g, "");
    expect(text).toContain(company);
    expect(text).toContain(email);
    expect(text).toContain("x".repeat(300));
  });

  it("keeps the normal layout within the margins", async () => {
    const { rightEdges, pageWidth } = await renderPages(filledForm);
    rightEdges.forEach((edge) => expect(edge).toBeLessThanOrEqual(pageWidth - 64 + 1));
  });

  it("puts a 'Page N of M' footer on every page", async () => {
    const { pages } = await renderPages(filledForm);
    expect(pages.length).toBeGreaterThanOrEqual(3);
    pages.forEach((text, i) => {
      expect(text).toMatch(new RegExp(`Mutual Non-Disclosure Agreement — Page ${i + 1} of ${pages.length}$`));
    });
  });

  it("moves the signing statement and table to the next page together when the cover page is long", async () => {
    const { pages } = await renderPages({ ...filledForm, modifications: "A long modification. ".repeat(60) });
    expect(pages[0]).not.toContain("By signing this Cover Page");
    expect(pages[0]).not.toContain("PARTY 1");
    expect(pages[1]).toMatch(/^By signing this Cover Page/);
    expect(pages[1]).toContain("PARTY 1");
    expect(pages[1]).toContain("Ada Lovelace");
  });

  it("handles very long input in every field without failing", async () => {
    const long = "word ".repeat(400);
    const parties: NdaFormData["parties"] = [
      { name: long, title: long, company: long, noticeAddress: long },
      { name: long, title: long, company: long, noticeAddress: long },
    ];
    const { pages } = await renderPages({
      ...filledForm,
      purpose: long,
      governingLaw: long,
      modifications: long,
      parties,
    });
    expect(pages.length).toBeGreaterThan(3);
    expect(pages.at(-1)).toContain("CC BY 4.0");
  });
});

describe("lineBreakParts", () => {
  it("never splits ordinary words", () => {
    expect(lineBreakParts("Confidential")).toEqual(["Confidential"]);
    expect(lineBreakParts("mutual-nda/1.0")).toEqual(["mutual-nda/1.0"]);
    expect(lineBreakParts("a".repeat(24))).toEqual(["a".repeat(24)]);
  });

  it("adds break points to long tokens after separators and every 12 characters", () => {
    expect(lineBreakParts("averyveryverylongname@example-domain.test")).toEqual([
      "averyveryver",
      "",
      "ylongname@",
      "",
      "example-",
      "",
      "domain.",
      "",
      "test",
    ]);
  });

  it("only inserts empty parts, so joining the parts gives back the original text", () => {
    const word = "x".repeat(100) + "/path/to-somewhere_else";
    const parts = lineBreakParts(word);
    expect(parts.join("")).toBe(word);
    expect(parts.filter((p) => p !== "").every((p) => p.length <= 12)).toBe(true);
  });
});
