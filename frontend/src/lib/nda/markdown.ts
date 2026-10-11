import type { Block, Inline } from "./types";

// Matches the only inline constructs used by the Common Paper templates:
// **bold**, [text](url), and <span class="coverpage_link">Term</span>.
const INLINE_TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|<span class="coverpage_link">(.+?)<\/span>/g;

/** Parses one line of template markdown into inline runs. */
export function parseInline(source: string): Inline[] {
  const runs: Inline[] = [];
  let last = 0;

  for (const match of source.matchAll(INLINE_TOKEN)) {
    if (match.index > last) runs.push({ text: source.slice(last, match.index) });

    const [, bold, linkText, href, coverPageTerm] = match;
    if (bold !== undefined) runs.push({ text: bold, bold: true });
    else if (linkText !== undefined) runs.push({ text: linkText, href });
    else runs.push({ text: coverPageTerm, kind: "ref" });

    last = match.index + match[0].length;
  }

  if (last < source.length) runs.push({ text: source.slice(last) });
  return runs;
}

/**
 * Converts the Mutual NDA Standard Terms markdown into document blocks.
 * Each blank-line-separated chunk is a heading, a numbered section, or a paragraph.
 */
export function parseStandardTerms(markdown: string): Block[] {
  return markdown
    .split(/\r?\n\s*\r?\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): Block => {
      const heading = chunk.match(/^(#{1,3})\s+(.*)$/);
      if (heading) {
        return {
          type: "heading",
          level: heading[1].length as 1 | 2 | 3,
          text: heading[2],
        };
      }

      const numbered = chunk.match(/^(\d+\.)\s+([\s\S]*)$/);
      if (numbered) {
        return { type: "paragraph", number: numbered[1], content: parseInline(numbered[2]) };
      }

      return { type: "paragraph", content: parseInline(chunk) };
    });
}
