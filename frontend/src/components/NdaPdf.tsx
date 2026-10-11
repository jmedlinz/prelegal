import { Document, Font, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Block, Inline, NdaDocument } from "@/lib/nda/types";

// Loaded only in the browser, on demand, by DownloadPdfButton.

/** Tokens longer than this may wrap mid-token, so a long email or URL can't overflow its cell or the page. */
const LONG_TOKEN = 24;

/**
 * Line-break hints for react-pdf. Ordinary words are never hyphenated: a split word in a legal document (or a URL
 * such as "common-paper.com") reads as different text. Long tokens get break points after "-", "/", "@", "." and
 * "_", and every 12 characters otherwise. Each break point is an empty part, which react-pdf treats as zero-width
 * glue, so it can wrap there without inserting a hyphen.
 */
export function lineBreakParts(word: string): string[] {
  if (word.length <= LONG_TOKEN) return [word];
  const pieces = word.split(/(?<=[-/@._])/).flatMap((piece) => piece.match(/.{1,12}/g) ?? []);
  return pieces.flatMap((piece, i) => (i === 0 ? [piece] : ["", piece]));
}

Font.registerHyphenationCallback(lineBreakParts);

const LETTER_HEIGHT = 792; // points

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 64,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    lineHeight: 1.35,
  },
  h1: { fontFamily: "Times-Bold", fontSize: 17, textAlign: "center", marginBottom: 8 },
  h2: { fontFamily: "Times-Bold", fontSize: 12, textTransform: "uppercase", marginTop: 4, marginBottom: 4 },
  h3: { fontFamily: "Times-Bold", fontSize: 11, marginTop: 7, marginBottom: 1 },
  label: { fontFamily: "Times-Italic", fontSize: 8.5, color: "#64748b", marginBottom: 2 },
  paragraph: { marginBottom: 5, textAlign: "justify" },
  bold: { fontFamily: "Times-Bold" },
  link: { color: "#0369a1", textDecoration: "underline" },
  checkboxRow: { flexDirection: "row", marginBottom: 2 },
  checkbox: {
    width: 9,
    height: 9,
    borderWidth: 0.75,
    borderColor: "#334155",
    marginTop: 3,
    marginRight: 6,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    lineHeight: 1.2,
  },
  checkboxText: { flex: 1 },
  statement: { marginTop: 8, marginBottom: 6 },
  table: { borderTopWidth: 0.75, borderLeftWidth: 0.75, borderColor: "#94a3b8" },
  row: { flexDirection: "row" },
  cell: { flex: 1, minHeight: 21, padding: 4, borderRightWidth: 0.75, borderBottomWidth: 0.75, borderColor: "#94a3b8" },
  labelCell: { flex: 0.7, fontFamily: "Times-Bold" },
  headerCell: { fontFamily: "Times-Bold", textAlign: "center" },
  hint: { fontFamily: "Times-Italic", fontSize: 8, color: "#64748b" },
  // Anchored with `top`: on wrapped pages react-pdf 4.9 resolves `bottom` against the whole flow, drawing the footer off-page.
  footer: {
    position: "absolute",
    top: LETTER_HEIGHT - 34,
    left: 64,
    right: 64,
    fontSize: 8,
    color: "#64748b",
    textAlign: "center",
  },
});

function Runs({ content }: { content: Inline[] }) {
  return content.map((run, i) => {
    const text = (
      <Text key={i} style={run.bold ? styles.bold : undefined}>
        {run.text}
      </Text>
    );
    return run.href ? (
      <Link key={i} src={run.href} style={styles.link}>
        {text}
      </Link>
    ) : (
      text
    );
  });
}

function PdfBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return <Text style={styles[`h${block.level}`]}>{block.text}</Text>;
    case "label":
      return <Text style={styles.label}>{block.text}</Text>;
    case "paragraph":
      return (
        <Text style={styles.paragraph}>
          {block.number && `${block.number} `}
          <Runs content={block.content} />
        </Text>
      );
    case "checkbox":
      return (
        <View style={styles.checkboxRow} wrap={false}>
          <Text style={styles.checkbox}>{block.checked ? "X" : ""}</Text>
          <Text style={styles.checkboxText}>
            <Runs content={block.content} />
          </Text>
        </View>
      );
    case "signatures":
      return (
        <View wrap={false}>
          <Text style={styles.statement}>{block.statement}</Text>
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={[styles.cell, styles.labelCell]} />
              <Text style={[styles.cell, styles.headerCell]}>PARTY 1</Text>
              <Text style={[styles.cell, styles.headerCell]}>PARTY 2</Text>
            </View>
            {block.rows.map((row) => (
              <View key={row.label} style={styles.row}>
                <View style={[styles.cell, styles.labelCell]}>
                  <Text>{row.label}</Text>
                  {row.hint && <Text style={styles.hint}>{row.hint}</Text>}
                </View>
                {row.values.map((value, i) => (
                  <Text key={i} style={styles.cell}>
                    {value.text}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>
      );
    case "pageBreak":
      return <View break />;
  }
}

/** The NDA document model rendered as a react-pdf <Document>. */
export function NdaPdfDocument({ nda }: { nda: NdaDocument }) {
  return (
    <Document title="Mutual Non-Disclosure Agreement" creator="Prelegal">
      <Page size="LETTER" style={styles.page}>
        {nda.map((block, i) => (
          <PdfBlock key={i} block={block} />
        ))}
        <Text
          fixed
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Mutual Non-Disclosure Agreement — Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
