// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildNda, initialFormData } from "@/lib/nda/build";
import type { Block, NdaDocument } from "@/lib/nda/types";
import { filledForm } from "@/test/fixtures";
import { NdaPreview } from "./NdaPreview";

const terms: Block[] = [
  { type: "heading", level: 1, text: "Standard Terms" },
  {
    type: "paragraph",
    number: "1.",
    content: [
      { text: "Introduction", bold: true },
      { text: ". Use for the " },
      { text: "Purpose", kind: "ref" },
      { text: "." },
    ],
  },
];

const renderNda = (nda: NdaDocument) => render(<NdaPreview nda={nda} />);

describe("NdaPreview", () => {
  it("renders the document headings with the correct levels", () => {
    renderNda(buildNda(filledForm, terms));
    expect(screen.getByRole("heading", { level: 1, name: "Mutual Non-Disclosure Agreement" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Using this Mutual Non-Disclosure Agreement" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Governing Law & Jurisdiction" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Standard Terms" })).toBeInTheDocument();
  });

  it("highlights user-entered values", () => {
    renderNda(buildNda(filledForm, terms));
    expect(screen.getByText("Delaware")).toHaveClass("bg-sky-50");
    expect(screen.getByText("October 11, 2026")).toHaveClass("bg-sky-50");
  });

  it("highlights placeholders for blank required fields differently", () => {
    renderNda(buildNda(initialFormData, terms));
    for (const placeholder of ["[Effective Date]", "[Governing Law]", "[Jurisdiction]"]) {
      expect(screen.getByText(placeholder)).toHaveClass("bg-amber-100");
    }
  });

  it("styles cover page references in the Standard Terms", () => {
    renderNda(buildNda(filledForm, terms));
    expect(screen.getByText("Purpose", { selector: "span.underline" })).toBeInTheDocument();
  });

  it("renders bold text and section numbers", () => {
    renderNda(buildNda(filledForm, terms));
    const intro = screen.getByText("Introduction");
    expect(intro.tagName).toBe("STRONG");
    expect(intro.closest("p")).toHaveTextContent(/^1\.\s*Introduction\. Use for the Purpose\.$/);
  });

  it("exposes checkbox state to assistive technology", () => {
    renderNda(buildNda({ ...filledForm, confidentialityType: "perpetual" }, terms));
    expect(screen.getAllByRole("img").map((el) => el.getAttribute("aria-label"))).toEqual([
      "Checked",
      "Unchecked",
      "Unchecked",
      "Checked",
    ]);
  });

  it("opens links in a new tab safely", () => {
    renderNda(buildNda(filledForm, terms));
    const link = screen.getByRole("link", { name: "commonpaper.com/standards/mutual-nda/1.0" });
    expect(link).toHaveAttribute("href", "https://commonpaper.com/standards/mutual-nda/1.0");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the signature table with both parties' details", () => {
    renderNda(buildNda(filledForm, terms));
    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual(["PARTY 1", "PARTY 2"]);
    expect(
      within(table)
        .getAllByRole("rowheader")
        .map((th) => th.firstChild!.textContent),
    ).toEqual(["Signature", "Print Name", "Title", "Company", "Notice Address", "Date"]);
    const companyRow = within(table).getByRole("row", { name: /Company/ });
    expect(
      within(companyRow)
        .getAllByRole("cell")
        .map((td) => td.textContent),
    ).toEqual(["Acme, Inc.", "Globex"]);
    const signatureRow = within(table).getByRole("row", { name: /Signature/ });
    expect(
      within(signatureRow)
        .getAllByRole("cell")
        .map((td) => td.textContent),
    ).toEqual(["", ""]);
    expect(screen.getByText(/^By signing this Cover Page/)).toBeInTheDocument();
  });

  it("preserves line breaks in multi-line values", () => {
    renderNda(buildNda(filledForm, terms));
    const address = screen.getByText(/1 Main St/);
    expect(address.textContent).toBe("1 Main St\nSpringfield, IL");
    expect(address.closest("td")).toHaveClass("whitespace-pre-line");
  });

  it("marks the page break between the Cover Page and Standard Terms", () => {
    const { container } = renderNda(buildNda(filledForm, terms));
    expect(container.querySelectorAll("hr")).toHaveLength(1);
  });
});
