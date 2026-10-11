import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseInline, parseStandardTerms } from "./markdown";
import type { Block } from "./types";

describe("parseInline", () => {
  it("returns plain text as a single run", () => {
    expect(parseInline("Just text.")).toEqual([{ text: "Just text." }]);
  });

  it("returns no runs for an empty string", () => {
    expect(parseInline("")).toEqual([]);
  });

  it("parses bold, links and cover page references in order", () => {
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

  it("handles tokens at the very start and end of the line", () => {
    expect(parseInline("**Start** middle **End**")).toEqual([
      { text: "Start", bold: true },
      { text: " middle " },
      { text: "End", bold: true },
    ]);
  });

  it("handles adjacent tokens with no text between them", () => {
    expect(parseInline('**A**<span class="coverpage_link">B</span>')).toEqual([
      { text: "A", bold: true },
      { text: "B", kind: "ref" },
    ]);
  });

  it("keeps punctuation and curly quotes around bold text", () => {
    expect(parseInline("(“**Cover Page**”)")).toEqual([
      { text: "(“" },
      { text: "Cover Page", bold: true },
      { text: "”)" },
    ]);
  });

  it("is safe to call repeatedly (global regex state does not leak between calls)", () => {
    const line = "a **b** c";
    expect(parseInline(line)).toEqual(parseInline(line));
  });

  it("leaves unmatched markdown as literal text", () => {
    expect(parseInline("a ** b")).toEqual([{ text: "a ** b" }]);
  });
});

describe("parseStandardTerms", () => {
  it("recognises headings at each level", () => {
    expect(parseStandardTerms("# One\n\n## Two\n\n### Three")).toEqual([
      { type: "heading", level: 1, text: "One" },
      { type: "heading", level: 2, text: "Two" },
      { type: "heading", level: 3, text: "Three" },
    ]);
  });

  it("splits numbered sections into a number and content", () => {
    expect(parseStandardTerms("12. **Title**. Body.")).toEqual([
      {
        type: "paragraph",
        number: "12.",
        content: [{ text: "Title", bold: true }, { text: ". Body." }],
      },
    ]);
  });

  it("handles CRLF line endings and extra blank lines", () => {
    const blocks = parseStandardTerms("# Title\r\n\r\n\r\n1. First.\r\n\r\nClosing.\r\n");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "paragraph"]);
  });

  it("returns no blocks for empty input", () => {
    expect(parseStandardTerms("")).toEqual([]);
    expect(parseStandardTerms("\n\n  \n")).toEqual([]);
  });

  describe("against templates/Mutual-NDA.md", () => {
    const markdown = readFileSync(path.join(process.cwd(), "..", "templates", "Mutual-NDA.md"), "utf-8");
    const blocks = parseStandardTerms(markdown);
    const paragraphs = blocks.filter((b): b is Extract<Block, { type: "paragraph" }> => b.type === "paragraph");
    const allText = paragraphs.flatMap((p) => p.content.map((r) => r.text)).join("");

    it("produces the heading, 11 numbered sections and the attribution", () => {
      expect(blocks[0]).toEqual({ type: "heading", level: 1, text: "Standard Terms" });
      expect(paragraphs.map((p) => p.number)).toEqual([
        "1.",
        "2.",
        "3.",
        "4.",
        "5.",
        "6.",
        "7.",
        "8.",
        "9.",
        "10.",
        "11.",
        undefined,
      ]);
    });

    it("bolds each section title", () => {
      const titles = paragraphs.filter((p) => p.number).map((p) => p.content[0]);
      expect(titles.every((t) => t.bold)).toBe(true);
      expect(titles.map((t) => t.text)).toContain("Governing Law and Jurisdiction");
    });

    it("marks every cover page reference and leaves no raw markup behind", () => {
      const refs = paragraphs.flatMap((p) => p.content.filter((r) => r.kind === "ref").map((r) => r.text));
      expect(new Set(refs)).toEqual(
        new Set(["Purpose", "Effective Date", "MNDA Term", "Term of Confidentiality", "Governing Law", "Jurisdiction"]),
      );
      expect(allText).not.toMatch(/<span|<\/span>|\*\*|\]\(/);
    });

    it("preserves all of the template's words", () => {
      const stripped = markdown
        .replace(/<[^>]+>/g, "")
        .replace(/\*\*/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/^#+\s+/gm, "")
        .replace(/^\d+\.\s+/gm, "");
      const words = (s: string) => s.split(/\s+/).filter(Boolean);
      const headingText = blocks.flatMap((b) => (b.type === "heading" ? [b.text] : [])).join(" ");
      expect(words(`${headingText} ${paragraphs.map((p) => p.content.map((r) => r.text).join("")).join(" ")}`)).toEqual(
        words(stripped),
      );
    });

    it("links the attribution to the standard and the licence", () => {
      const links = paragraphs
        .at(-1)!
        .content.filter((r) => r.href)
        .map((r) => r.href);
      expect(links).toEqual([
        "https://commonpaper.com/standards/mutual-nda/1.0/",
        "https://creativecommons.org/licenses/by/4.0/",
      ]);
    });
  });
});
