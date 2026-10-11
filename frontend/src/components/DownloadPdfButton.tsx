"use client";

import { useState } from "react";
import type { NdaDocument } from "@/lib/nda/types";

interface DownloadPdfButtonProps {
  nda: NdaDocument;
  filename: string;
}

/** Generates the PDF in the browser and saves it. react-pdf is loaded only on first click. */
export function DownloadPdfButton({ nda, filename }: DownloadPdfButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const [{ pdf }, { NdaPdfDocument }] = await Promise.all([import("@react-pdf/renderer"), import("./NdaPdf")]);
      const blob = await pdf(<NdaPdfDocument nda={nda} />).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      // Defer revoking so the browser has started the download (needed by Safari).
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error(err);
      setError("Could not generate the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error && (
        <span role="alert" className="text-sm text-red-600">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? "Generating…" : "Download PDF"}
      </button>
    </div>
  );
}
