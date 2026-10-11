import { initialFormData } from "@/lib/nda/build";
import type { NdaFormData } from "@/lib/nda/types";

/** A fully filled-in form, shared by unit, component and PDF tests. */
export const filledForm: NdaFormData = {
  ...initialFormData,
  purpose: "Evaluating a potential joint venture.",
  effectiveDate: "2026-10-11",
  mndaTermYears: "2",
  confidentialityYears: "3",
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  modifications: "Section 8 is deleted.",
  parties: [
    { name: "Ada Lovelace", title: "CEO", company: "Acme, Inc.", noticeAddress: "ada@acme.test" },
    { name: "Alan Turing", title: "CTO", company: "Globex", noticeAddress: "1 Main St\nSpringfield, IL" },
  ],
};
