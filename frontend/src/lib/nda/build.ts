import type { Block, Inline, NdaDocument, NdaFormData, PartyInfo, PartyRow } from "./types";

const STANDARD_TERMS_URL = "https://commonpaper.com/standards/mutual-nda/1.0";
const CC_BY_URL = "https://creativecommons.org/licenses/by/4.0/";

const DEFAULT_PURPOSE = "Evaluating whether to enter into a business relationship with the other party.";

const EMPTY_PARTY: PartyInfo = { name: "", title: "", company: "", noticeAddress: "" };

export const initialFormData: NdaFormData = {
  purpose: DEFAULT_PURPOSE,
  effectiveDate: "",
  mndaTermType: "expires",
  mndaTermYears: "1",
  confidentialityType: "years",
  confidentialityYears: "1",
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  parties: [{ ...EMPTY_PARTY }, { ...EMPTY_PARTY }],
};

/** User-entered text, or a bracketed placeholder when the field is blank. */
function field(value: string, placeholder: string): Inline {
  const text = value.trim();
  return text ? { text, kind: "value" } : { text: `[${placeholder}]`, kind: "missing" };
}

/** Party detail: left blank (to fill in by hand) rather than flagged as missing. */
function partyValue(value: string): Inline {
  return { text: value.trim(), kind: "value" };
}

function years(raw: string): Inline {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return { text: "[number of years]", kind: "missing" };
  return { text: `${n} ${n === 1 ? "year" : "years"}`, kind: "value" };
}

/**
 * Formats an ISO date (YYYY-MM-DD) as e.g. "October 11, 2026" without timezone drift.
 * Returns null for unparseable input.
 */
export function formatDate(iso: string): string | null {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(y, m - 1, d); // unlike Date.UTC, keeps years 0-99 literal
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { timeZone: "UTC", dateStyle: "long" });
}

function partyRow(
  label: string,
  pick: (p: PartyInfo) => string,
  parties: NdaFormData["parties"],
  hint?: string,
): PartyRow {
  return { label, hint, values: [partyValue(pick(parties[0])), partyValue(pick(parties[1]))] };
}

/** Builds the filled-in Cover Page, mirroring templates/Mutual-NDA-Coverpage.md. */
export function buildCoverPage(data: NdaFormData): Block[] {
  const { parties } = data;
  const blank: Inline = { text: "" };

  return [
    { type: "heading", level: 1, text: "Mutual Non-Disclosure Agreement" },
    { type: "heading", level: 2, text: "Using this Mutual Non-Disclosure Agreement" },
    {
      type: "paragraph",
      content: [
        { text: "This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“" },
        { text: "Cover Page", bold: true },
        { text: "”) and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 (“" },
        { text: "Standard Terms", bold: true },
        { text: "”) identical to those posted at " },
        { text: "commonpaper.com/standards/mutual-nda/1.0", href: STANDARD_TERMS_URL },
        {
          text: ". Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.",
        },
      ],
    },

    { type: "heading", level: 3, text: "Purpose" },
    { type: "label", text: "How Confidential Information may be used" },
    { type: "paragraph", content: [field(data.purpose, "Purpose")] },

    { type: "heading", level: 3, text: "Effective Date" },
    { type: "paragraph", content: [field(formatDate(data.effectiveDate) ?? "", "Effective Date")] },

    { type: "heading", level: 3, text: "MNDA Term" },
    { type: "label", text: "The length of this MNDA" },
    {
      type: "checkbox",
      checked: data.mndaTermType === "expires",
      content: [
        { text: "Expires " },
        data.mndaTermType === "expires" ? years(data.mndaTermYears) : { text: "____ year(s)" },
        { text: " from Effective Date." },
      ],
    },
    {
      type: "checkbox",
      checked: data.mndaTermType === "untilTerminated",
      content: [{ text: "Continues until terminated in accordance with the terms of the MNDA." }],
    },

    { type: "heading", level: 3, text: "Term of Confidentiality" },
    { type: "label", text: "How long Confidential Information is protected" },
    {
      type: "checkbox",
      checked: data.confidentialityType === "years",
      content: [
        data.confidentialityType === "years" ? years(data.confidentialityYears) : { text: "____ year(s)" },
        {
          text: " from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.",
        },
      ],
    },
    {
      type: "checkbox",
      checked: data.confidentialityType === "perpetual",
      content: [{ text: "In perpetuity." }],
    },

    { type: "heading", level: 3, text: "Governing Law & Jurisdiction" },
    { type: "paragraph", content: [{ text: "Governing Law: " }, field(data.governingLaw, "Governing Law")] },
    { type: "paragraph", content: [{ text: "Jurisdiction: " }, field(data.jurisdiction, "Jurisdiction")] },

    { type: "heading", level: 3, text: "MNDA Modifications" },
    {
      type: "paragraph",
      content: [data.modifications.trim() ? { text: data.modifications.trim(), kind: "value" } : { text: "None." }],
    },

    {
      type: "signatures",
      statement: "By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.",
      rows: [
        { label: "Signature", values: [blank, blank] },
        partyRow("Print Name", (p) => p.name, parties),
        partyRow("Title", (p) => p.title, parties),
        partyRow("Company", (p) => p.company, parties),
        partyRow("Notice Address", (p) => p.noticeAddress, parties, "Use either email or postal address"),
        { label: "Date", values: [blank, blank] },
      ],
    },
    {
      type: "paragraph",
      content: [
        { text: "Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use under " },
        { text: "CC BY 4.0", href: CC_BY_URL },
        { text: "." },
      ],
    },
  ];
}

/** Combines the filled-in Cover Page with the (pre-parsed) Standard Terms. */
export function buildNda(data: NdaFormData, standardTerms: Block[]): NdaDocument {
  return [...buildCoverPage(data), { type: "pageBreak" }, ...standardTerms];
}

/** Suggested download filename, e.g. "Mutual-NDA-Acme-Inc-Globex.pdf". */
export function pdfFilename(data: NdaFormData): string {
  const slug = (s: string) =>
    s
      .trim()
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const companies = data.parties.map((p) => slug(p.company)).filter(Boolean);
  return ["Mutual-NDA", ...companies].join("-") + ".pdf";
}
