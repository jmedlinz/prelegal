import { readFile } from "node:fs/promises";
import { expect, type Locator, type Page } from "@playwright/test";
import { readPdf, type PdfContents } from "../src/test/pdfText";

export interface PartyDetails {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
}

/** Page object for the Mutual NDA Creator. */
export class NdaPage {
  readonly form: Locator;
  readonly preview: Locator;
  readonly downloadButton: Locator;
  private readonly consoleErrors: string[] = [];

  constructor(readonly page: Page) {
    this.form = page.locator("form");
    this.preview = page.getByRole("article");
    this.downloadButton = page.getByRole("button", { name: "Download PDF" });
    page.on("console", (msg) => {
      if (msg.type() === "error") this.consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => this.consoleErrors.push(err.message));
  }

  async goto() {
    await this.page.goto("/");
    await expect(this.page.getByRole("heading", { name: "Mutual NDA Creator" })).toBeVisible();
  }

  field(label: string) {
    return this.form.getByLabel(label, { exact: true });
  }

  party(n: 1 | 2) {
    return this.form.getByRole("group", { name: `Party ${n}` });
  }

  async fillParty(n: 1 | 2, details: PartyDetails) {
    const party = this.party(n);
    await party.getByLabel("Print Name").fill(details.name);
    await party.getByLabel("Title").fill(details.title);
    await party.getByLabel("Company").fill(details.company);
    await party.getByLabel("Notice Address").fill(details.noticeAddress);
  }

  /** Clicks Download PDF and returns the saved file's name and parsed contents. */
  async downloadPdf(): Promise<{ filename: string } & PdfContents> {
    const [download] = await Promise.all([this.page.waitForEvent("download"), this.downloadButton.click()]);
    const path = await download.path();
    return { filename: download.suggestedFilename(), ...(await readPdf(new Uint8Array(await readFile(path)))) };
  }

  /** Console errors and uncaught exceptions seen since the page object was created. */
  errors() {
    return [...this.consoleErrors];
  }
}

export const sampleAgreement = {
  purpose: "Evaluating a potential joint venture.",
  effectiveDate: "2026-10-11",
  mndaYears: "2",
  confidentialityYears: "3",
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  modifications: "Section 8 is deleted.",
  parties: [
    { name: "Ada Lovelace", title: "CEO", company: "Acme, Inc.", noticeAddress: "ada@acme.test" },
    { name: "Alan Turing", title: "CTO", company: "Globex", noticeAddress: "1 Main St\nSpringfield, IL" },
  ] as const satisfies readonly [PartyDetails, PartyDetails],
};

/** Fills in every field of the form with `sampleAgreement`. */
export async function fillSampleAgreement(nda: NdaPage) {
  const a = sampleAgreement;
  await nda.field("Purpose").fill(a.purpose);
  await nda.field("Effective Date").fill(a.effectiveDate);
  await nda.field("MNDA term in years").fill(a.mndaYears);
  await nda.field("Confidentiality term in years").fill(a.confidentialityYears);
  await nda.field("Governing Law").fill(a.governingLaw);
  await nda.field("Jurisdiction").fill(a.jurisdiction);
  await nda.field("Modifications").fill(a.modifications);
  await nda.fillParty(1, a.parties[0]);
  await nda.fillParty(2, a.parties[1]);
}
