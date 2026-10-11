// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NdaDocument } from "@/lib/nda/types";
import { DownloadPdfButton } from "./DownloadPdfButton";

const pdfMock = vi.hoisted(() => ({
  toBlob: vi.fn<() => Promise<Blob>>(),
  pdf: vi.fn(),
}));

vi.mock("@react-pdf/renderer", () => ({
  pdf: (element: unknown) => {
    pdfMock.pdf(element);
    return { toBlob: pdfMock.toBlob };
  },
}));
vi.mock("./NdaPdf", () => ({ NdaPdfDocument: () => null }));

const nda: NdaDocument = [{ type: "heading", level: 1, text: "Mutual Non-Disclosure Agreement" }];

let clicked: HTMLAnchorElement[];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  clicked = [];
  pdfMock.pdf.mockClear();
  pdfMock.toBlob.mockReset().mockResolvedValue(new Blob(["%PDF-1.3"], { type: "application/pdf" }));
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this);
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const button = () => screen.getByRole("button", { name: /Download PDF|Generating/ });

describe("DownloadPdfButton", () => {
  it("renders an enabled Download PDF button", () => {
    render(<DownloadPdfButton nda={nda} filename="Mutual-NDA.pdf" />);
    expect(button()).toHaveTextContent("Download PDF");
    expect(button()).toBeEnabled();
    expect(button()).toHaveAttribute("type", "button");
  });

  it("generates the PDF from the given document and saves it with the given filename", async () => {
    render(<DownloadPdfButton nda={nda} filename="Mutual-NDA-Acme.pdf" />);
    fireEvent.click(button());

    await vi.waitFor(() => expect(clicked).toHaveLength(1));
    expect(pdfMock.pdf).toHaveBeenCalledTimes(1);
    expect(pdfMock.pdf.mock.calls[0][0]).toMatchObject({ props: { nda } });
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clicked[0].download).toBe("Mutual-NDA-Acme.pdf");
    expect(clicked[0].href).toBe("blob:mock-url");
  });

  it("disables the button and shows progress while generating", async () => {
    let resolve!: (blob: Blob) => void;
    pdfMock.toBlob.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<DownloadPdfButton nda={nda} filename="Mutual-NDA.pdf" />);

    fireEvent.click(button());
    await vi.waitFor(() => expect(button()).toHaveTextContent("Generating…"));
    expect(button()).toBeDisabled();

    await act(async () => resolve(new Blob(["%PDF"])));
    await vi.waitFor(() => expect(button()).toHaveTextContent("Download PDF"));
    expect(button()).toBeEnabled();
  });

  it("revokes the object URL after the download starts", async () => {
    render(<DownloadPdfButton nda={nda} filename="Mutual-NDA.pdf" />);
    fireEvent.click(button());
    await vi.waitFor(() => expect(clicked).toHaveLength(1));

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("shows an error and re-enables the button when generation fails", async () => {
    pdfMock.toBlob.mockRejectedValue(new Error("boom"));
    render(<DownloadPdfButton nda={nda} filename="Mutual-NDA.pdf" />);

    fireEvent.click(button());
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not generate the PDF. Please try again.");
    expect(button()).toBeEnabled();
    expect(clicked).toHaveLength(0);
  });

  it("clears a previous error when retrying", async () => {
    pdfMock.toBlob.mockRejectedValueOnce(new Error("boom"));
    render(<DownloadPdfButton nda={nda} filename="Mutual-NDA.pdf" />);

    fireEvent.click(button());
    await screen.findByText(/Could not generate/);
    fireEvent.click(button());

    await vi.waitFor(() => expect(clicked).toHaveLength(1));
    expect(screen.queryByText(/Could not generate/)).not.toBeInTheDocument();
  });

  it("uses the latest document when clicked after an update", async () => {
    const { rerender } = render(<DownloadPdfButton nda={nda} filename="Old.pdf" />);
    const updated: NdaDocument = [{ type: "heading", level: 1, text: "Updated" }];
    rerender(<DownloadPdfButton nda={updated} filename="New.pdf" />);

    fireEvent.click(button());
    await vi.waitFor(() => expect(clicked).toHaveLength(1));
    expect(pdfMock.pdf.mock.calls[0][0]).toMatchObject({ props: { nda: updated } });
    expect(clicked[0].download).toBe("New.pdf");
  });
});
