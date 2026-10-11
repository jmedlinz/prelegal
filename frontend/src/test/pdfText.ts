import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PdfContents {
  title: string | undefined;
  /** Text of each page, with line breaks and repeated whitespace collapsed to single spaces. */
  pages: string[];
  /** Right edge (in points) of the furthest-right text on each page. */
  rightEdges: number[];
  /** Page width in points. */
  pageWidth: number;
}

/** Extracts the title metadata and per-page text of a PDF using pdf.js. */
export async function readPdf(data: Uint8Array): Promise<PdfContents> {
  const task = getDocument({ data, useSystemFonts: true });
  try {
    const pdf = await task.promise;
    const { info } = await pdf.getMetadata();
    const pages: string[] = [];
    const rightEdges: number[] = [];
    let pageWidth = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      pageWidth = page.view[2];
      const { items } = await page.getTextContent();
      rightEdges.push(Math.max(...items.map((item) => ("str" in item ? item.transform[4] + item.width : 0))));
      // Runs on the same line already carry their own spacing; only line ends need a separator.
      const text = items.map((item) => ("str" in item ? item.str + (item.hasEOL ? " " : "") : "")).join("");
      pages.push(text.replace(/\s+/g, " ").trim());
    }
    return { title: (info as { Title?: string }).Title, pages, rightEdges, pageWidth };
  } finally {
    await task.destroy();
  }
}
