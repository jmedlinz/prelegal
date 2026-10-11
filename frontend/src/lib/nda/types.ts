/** Details for one signing party, as shown in the Cover Page signature table. */
export interface PartyInfo {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
}

/** Everything the user fills in on the form. Numeric inputs are kept as raw strings. */
export interface NdaFormData {
  purpose: string;
  /** ISO date (YYYY-MM-DD) from the date input, or "" when unset. */
  effectiveDate: string;
  mndaTermType: "expires" | "untilTerminated";
  mndaTermYears: string;
  confidentialityType: "years" | "perpetual";
  confidentialityYears: string;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  parties: [PartyInfo, PartyInfo];
}

/**
 * A run of text within a block.
 * - `value`: text the user entered
 * - `missing`: a bracketed placeholder for a field the user has not filled in
 * - `ref`: a defined term that refers back to the Cover Page
 */
export interface Inline {
  text: string;
  bold?: boolean;
  href?: string;
  kind?: "value" | "missing" | "ref";
}

export interface PartyRow {
  label: string;
  hint?: string;
  values: [Inline, Inline];
}

/** Format-neutral document model, rendered both as HTML (preview) and as PDF. */
export type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "label"; text: string }
  | { type: "paragraph"; content: Inline[]; number?: string }
  | { type: "checkbox"; checked: boolean; content: Inline[] }
  | { type: "signatures"; statement: string; rows: PartyRow[] }
  | { type: "pageBreak" };

export type NdaDocument = Block[];
