import type { ReactNode } from "react";
import type { Block, Inline, NdaDocument } from "@/lib/nda/types";

const INLINE_STYLES: Record<NonNullable<Inline["kind"]>, string> = {
  value: "bg-sky-50 text-sky-950",
  missing: "bg-amber-100 text-amber-900",
  ref: "underline decoration-dotted decoration-slate-400 underline-offset-2",
};

function Runs({ content }: { content: Inline[] }) {
  return content.map((run, i) => {
    let node: ReactNode = run.text;
    if (run.bold) node = <strong>{node}</strong>;
    if (run.href) {
      node = (
        <a href={run.href} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">
          {node}
        </a>
      );
    }
    return run.kind ? (
      <span key={i} className={`rounded px-0.5 ${INLINE_STYLES[run.kind]}`}>
        {node}
      </span>
    ) : (
      <span key={i}>{node}</span>
    );
  });
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      role="img"
      aria-label={checked ? "Checked" : "Unchecked"}
      className="mt-1 inline-flex size-3.5 shrink-0 items-center justify-center border border-slate-700 text-[10px] font-bold leading-none"
    >
      {checked ? "X" : ""}
    </span>
  );
}

function PreviewBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      if (block.level === 1) return <h1 className="mb-4 text-center text-2xl font-bold">{block.text}</h1>;
      if (block.level === 2) return <h2 className="mt-6 mb-2 text-lg font-semibold uppercase">{block.text}</h2>;
      return <h3 className="mt-5 mb-1 font-semibold">{block.text}</h3>;
    case "label":
      return <p className="-mt-1 mb-1 text-xs text-slate-500 italic">{block.text}</p>;
    case "paragraph":
      return (
        <p className="mb-3 whitespace-pre-line">
          {block.number && <span className="mr-1">{block.number}</span>}
          <Runs content={block.content} />
        </p>
      );
    case "checkbox":
      return (
        <p className="mb-1 flex gap-2">
          <Checkbox checked={block.checked} />
          <span>
            <Runs content={block.content} />
          </span>
        </p>
      );
    case "signatures":
      return (
        <>
          <p className="mt-5 mb-3">{block.statement}</p>
          <table className="mb-4 w-full table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <td className="w-1/4 border border-slate-300 p-2" />
                <th scope="col" className="border border-slate-300 p-2">
                  PARTY 1
                </th>
                <th scope="col" className="border border-slate-300 p-2">
                  PARTY 2
                </th>
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="border border-slate-300 p-2 text-left align-top font-medium">
                    {row.label}
                    {row.hint && <span className="block text-xs font-normal text-slate-500 italic">{row.hint}</span>}
                  </th>
                  {row.values.map((value, i) => (
                    <td key={i} className="h-10 border border-slate-300 p-2 align-top whitespace-pre-line">
                      {value.text && <Runs content={[value]} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    case "pageBreak":
      return <hr className="my-10 border-t-2 border-dashed border-slate-300" />;
  }
}

/** Renders the NDA document model as HTML, styled like a sheet of paper. */
export function NdaPreview({ nda }: { nda: NdaDocument }) {
  return (
    <article className="mx-auto max-w-[8.5in] bg-white wrap-anywhere px-8 py-10 font-serif text-[15px] leading-relaxed text-slate-900 shadow-md ring-1 ring-slate-200 sm:px-14">
      {nda.map((block, i) => (
        <PreviewBlock key={i} block={block} />
      ))}
    </article>
  );
}
