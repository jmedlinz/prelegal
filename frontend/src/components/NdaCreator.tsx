"use client";

import { useMemo, useState } from "react";
import { buildNda, initialFormData, pdfFilename } from "@/lib/nda/build";
import type { Block } from "@/lib/nda/types";
import { DownloadPdfButton } from "./DownloadPdfButton";
import { NdaForm } from "./NdaForm";
import { NdaPreview } from "./NdaPreview";

/** Form on the left, live document preview on the right. */
export function NdaCreator({ standardTerms }: { standardTerms: Block[] }) {
  const [data, setData] = useState(initialFormData);
  const nda = useMemo(() => buildNda(data, standardTerms), [data, standardTerms]);

  return (
    <div className="grid flex-1 lg:grid-cols-[420px_1fr]">
      <aside className="border-b border-slate-200 bg-white px-6 py-6 lg:sticky lg:top-[65px] lg:h-[calc(100vh-65px)] lg:overflow-y-auto lg:border-r lg:border-b-0">
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Agreement details</h2>
        <p className="mb-5 text-sm text-slate-600">
          The preview updates as you type. Blank required fields are{" "}
          <span className="rounded bg-amber-100 px-1 text-amber-900">highlighted</span>; signatures and dates are left
          blank for signing.
        </p>
        <NdaForm data={data} onChange={setData} />
      </aside>

      <section className="bg-slate-100 px-4 py-6 sm:px-8">
        <div className="sticky top-[65px] z-[5] mx-auto mb-4 flex max-w-[8.5in] items-center justify-between gap-4 bg-slate-100 py-2">
          <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">Preview</h2>
          <DownloadPdfButton nda={nda} filename={pdfFilename(data)} />
        </div>
        <NdaPreview nda={nda} />
      </section>
    </div>
  );
}
