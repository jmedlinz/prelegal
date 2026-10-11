// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { loadStandardTerms } from "@/lib/nda/templates";
import type { Block } from "@/lib/nda/types";
import { NdaCreator } from "./NdaCreator";

// The download itself is covered by DownloadPdfButton tests and the end-to-end suite.
vi.mock("./DownloadPdfButton", () => ({
  DownloadPdfButton: ({ filename }: { filename: string }) => <button data-filename={filename}>Download PDF</button>,
}));

let standardTerms: Block[];
beforeAll(async () => {
  standardTerms = await loadStandardTerms();
});

function renderCreator() {
  render(<NdaCreator standardTerms={standardTerms} />);
  const preview = within(screen.getByRole("article"));
  const party = (n: 1 | 2) => within(screen.getByRole("group", { name: `Party ${n}` }));
  return { user: userEvent.setup(), preview, party };
}

describe("NdaCreator", () => {
  it("shows the form and a preview of the full agreement", () => {
    const { preview } = renderCreator();
    expect(screen.getByRole("heading", { name: "Agreement details" })).toBeInTheDocument();
    expect(preview.getByRole("heading", { name: "Mutual Non-Disclosure Agreement" })).toBeInTheDocument();
    expect(preview.getByRole("heading", { name: "Standard Terms" })).toBeInTheDocument();
    expect(preview.getByText("General")).toBeInTheDocument();
  });

  it("starts with placeholders for the required fields", () => {
    const { preview } = renderCreator();
    for (const placeholder of ["[Effective Date]", "[Governing Law]", "[Jurisdiction]"]) {
      expect(preview.getByText(placeholder)).toBeInTheDocument();
    }
  });

  it("updates the preview live as the user types", async () => {
    const { user, preview } = renderCreator();
    await user.type(screen.getByLabelText("Governing Law"), "Delaware");
    expect(preview.getByText("Delaware")).toBeInTheDocument();
    expect(preview.queryByText("[Governing Law]")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Governing Law"));
    expect(preview.getByText("[Governing Law]")).toBeInTheDocument();
  });

  it("shows the formatted effective date", () => {
    const { preview } = renderCreator();
    fireEvent.change(screen.getByLabelText("Effective Date"), { target: { value: "2026-10-11" } });
    expect(preview.getByText("October 11, 2026")).toBeInTheDocument();
  });

  it("reflects the chosen terms", async () => {
    const { user, preview } = renderCreator();
    const years = screen.getByLabelText("MNDA term in years");
    await user.clear(years);
    await user.type(years, "3");
    expect(preview.getByText("3 years")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "In perpetuity" }));
    expect(preview.getAllByRole("img").map((el) => el.getAttribute("aria-label"))).toEqual([
      "Checked",
      "Unchecked",
      "Unchecked",
      "Checked",
    ]);
  });

  it("puts each party's details in the right column of the signature table", async () => {
    const { user, preview, party } = renderCreator();
    await user.type(party(1).getByLabelText("Company"), "Acme, Inc.");
    await user.type(party(2).getByLabelText("Company"), "Globex");
    const companyRow = within(preview.getByRole("table")).getByRole("row", { name: /Company/ });
    expect(
      within(companyRow)
        .getAllByRole("cell")
        .map((td) => td.textContent),
    ).toEqual(["Acme, Inc.", "Globex"]);
  });

  it("names the download after the companies", async () => {
    const { user, party } = renderCreator();
    expect(screen.getByRole("button", { name: "Download PDF" })).toHaveAttribute("data-filename", "Mutual-NDA.pdf");
    await user.type(party(1).getByLabelText("Company"), "Acme, Inc.");
    expect(screen.getByRole("button", { name: "Download PDF" })).toHaveAttribute(
      "data-filename",
      "Mutual-NDA-Acme-Inc.pdf",
    );
  });
});
