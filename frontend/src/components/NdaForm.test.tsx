// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { initialFormData } from "@/lib/nda/build";
import type { NdaFormData } from "@/lib/nda/types";
import { NdaForm } from "./NdaForm";

/** Renders the form with real state, exposing the latest data through `onData`. */
function renderForm(initial: NdaFormData = initialFormData) {
  const onData = vi.fn<(data: NdaFormData) => void>();
  function Harness() {
    const [data, setData] = useState(initial);
    return (
      <NdaForm
        data={data}
        onChange={(next) => {
          setData(next);
          onData(next);
        }}
      />
    );
  }
  render(<Harness />);
  const latest = () => onData.mock.lastCall![0];
  return { user: userEvent.setup(), onData, latest };
}

const partySection = (n: 1 | 2) => within(screen.getByRole("group", { name: `Party ${n}` }));

describe("NdaForm", () => {
  it("shows the template defaults", () => {
    renderForm();
    expect(screen.getByLabelText("Purpose")).toHaveValue(
      "Evaluating whether to enter into a business relationship with the other party.",
    );
    expect(screen.getByLabelText("Effective Date")).toHaveValue("");
    expect(screen.getByLabelText("MNDA term in years")).toHaveValue(1);
    expect(screen.getByLabelText("Confidentiality term in years")).toHaveValue(1);
    expect(screen.getByRole("radio", { name: /Expires/ })).toBeChecked();
    const confidentiality = within(screen.getByRole("group", { name: "Term of Confidentiality" }));
    expect(confidentiality.getByRole("radio", { name: /year\(s\) from Effective Date/ })).toBeChecked();
    expect(confidentiality.getByRole("radio", { name: "In perpetuity" })).not.toBeChecked();
  });

  it("groups fields into labelled sections", () => {
    renderForm();
    expect(screen.getAllByRole("group").map((g) => g.querySelector("legend")!.textContent)).toEqual([
      "Agreement",
      "MNDA Term",
      "Term of Confidentiality",
      "Governing Law & Jurisdiction",
      "MNDA Modifications",
      "Party 1",
      "Party 2",
    ]);
  });

  it("describes fields with their hints", () => {
    renderForm();
    expect(screen.getByLabelText("Governing Law")).toHaveAccessibleDescription("State, e.g. Delaware");
    expect(screen.getByLabelText("Jurisdiction")).toHaveAccessibleDescription(
      "City or county and state, e.g. courts located in New Castle, DE",
    );
    expect(screen.getByLabelText("Effective Date")).not.toHaveAccessibleDescription();
  });

  it.each([
    ["Governing Law", "governingLaw", "Delaware"],
    ["Jurisdiction", "jurisdiction", "courts located in New Castle, DE"],
    ["Modifications", "modifications", "Section 8 is deleted."],
  ] as const)("updates %s as the user types", async (label, key, value) => {
    const { user, latest } = renderForm();
    await user.type(screen.getByLabelText(label), value);
    expect(latest()[key]).toBe(value);
  });

  it("replaces the default purpose", async () => {
    const { user, latest } = renderForm();
    const purpose = screen.getByLabelText("Purpose");
    await user.clear(purpose);
    await user.type(purpose, "A joint venture.");
    expect(latest().purpose).toBe("A joint venture.");
  });

  it("keeps line breaks typed into multi-line fields", async () => {
    const { user, latest } = renderForm();
    await user.type(screen.getByLabelText("Modifications"), "Line one.{Enter}Line two.");
    expect(latest().modifications).toBe("Line one.\nLine two.");
  });

  it("stores the effective date in ISO format", () => {
    const { latest } = renderForm();
    fireEvent.change(screen.getByLabelText("Effective Date"), { target: { value: "2026-10-11" } });
    expect(latest().effectiveDate).toBe("2026-10-11");
  });

  describe("MNDA term", () => {
    it("updates the number of years", async () => {
      const { user, latest } = renderForm();
      const years = screen.getByLabelText("MNDA term in years");
      await user.clear(years);
      await user.type(years, "3");
      expect(latest().mndaTermYears).toBe("3");
    });

    it("switches to 'until terminated' and disables the years input", async () => {
      const { user, latest } = renderForm();
      await user.click(screen.getByRole("radio", { name: "Continues until terminated" }));
      expect(latest().mndaTermType).toBe("untilTerminated");
      expect(screen.getByLabelText("MNDA term in years")).toBeDisabled();
      expect(screen.getByLabelText("Confidentiality term in years")).toBeEnabled();
    });

    it("switches back to a fixed term and re-enables the years input", async () => {
      const { user, latest } = renderForm({ ...initialFormData, mndaTermType: "untilTerminated" });
      await user.click(screen.getByRole("radio", { name: /Expires/ }));
      expect(latest().mndaTermType).toBe("expires");
      expect(screen.getByLabelText("MNDA term in years")).toBeEnabled();
    });
  });

  describe("term of confidentiality", () => {
    it("switches to 'In perpetuity' and disables the years input", async () => {
      const { user, latest } = renderForm();
      await user.click(screen.getByRole("radio", { name: "In perpetuity" }));
      expect(latest().confidentialityType).toBe("perpetual");
      expect(screen.getByLabelText("Confidentiality term in years")).toBeDisabled();
      expect(screen.getByLabelText("MNDA term in years")).toBeEnabled();
    });

    it("updates the number of years", async () => {
      const { user, latest } = renderForm();
      const years = screen.getByLabelText("Confidentiality term in years");
      await user.clear(years);
      await user.type(years, "5");
      expect(latest().confidentialityYears).toBe("5");
    });

    it("switches back to a number of years and re-enables the years input", async () => {
      const { user, latest } = renderForm({ ...initialFormData, confidentialityType: "perpetual" });
      const group = within(screen.getByRole("group", { name: "Term of Confidentiality" }));
      await user.click(group.getByRole("radio", { name: /year\(s\) from Effective Date/ }));
      expect(latest().confidentialityType).toBe("years");
      expect(screen.getByLabelText("Confidentiality term in years")).toBeEnabled();
    });

    it("keeps the two radio groups independent", async () => {
      const { user } = renderForm();
      await user.click(screen.getByRole("radio", { name: "In perpetuity" }));
      expect(screen.getByRole("radio", { name: /Expires/ })).toBeChecked();
    });
  });

  describe("parties", () => {
    it.each([1, 2] as const)("updates only party %i's details", async (n) => {
      const { user, latest } = renderForm();
      const party = partySection(n);
      await user.type(party.getByLabelText("Print Name"), "Ada Lovelace");
      await user.type(party.getByLabelText("Title"), "CEO");
      await user.type(party.getByLabelText("Company"), "Acme");
      await user.type(party.getByLabelText("Notice Address"), "ada@acme.test");

      const other = latest().parties[n === 1 ? 1 : 0];
      expect(latest().parties[n - 1]).toEqual({
        name: "Ada Lovelace",
        title: "CEO",
        company: "Acme",
        noticeAddress: "ada@acme.test",
      });
      expect(other).toEqual({ name: "", title: "", company: "", noticeAddress: "" });
    });

    it("explains what to enter as the notice address", () => {
      renderForm();
      expect(partySection(1).getByLabelText("Notice Address")).toHaveAccessibleDescription("Email or postal address");
    });
  });

  it("prevents the browser's default form submission (which would reload the page)", () => {
    renderForm();
    const form = screen.getByLabelText("Governing Law").closest("form")!;
    const event = new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not mutate the data it was given", async () => {
    const initial = structuredClone(initialFormData);
    const { user } = renderForm(initial);
    await user.type(partySection(1).getByLabelText("Company"), "Acme");
    await user.type(screen.getByLabelText("Governing Law"), "Delaware");
    expect(initial).toEqual(initialFormData);
  });
});
