import { NdaCreator } from "@/components/NdaCreator";
import { loadStandardTerms } from "@/lib/nda/templates";

// The template does not vary per request, so read it once at module scope (included in the static shell).
const standardTerms = await loadStandardTerms();

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-10 flex h-[65px] items-center justify-between border-b border-slate-200 bg-white px-6">
        <div>
          <p className="text-xs font-semibold tracking-widest text-sky-700 uppercase">Prelegal</p>
          <h1 className="text-lg font-semibold text-slate-900">Mutual NDA Creator</h1>
        </div>
        <p className="hidden text-xs text-slate-500 sm:block">Based on the Common Paper Mutual NDA v1.0 (CC BY 4.0)</p>
      </header>
      <main className="flex flex-1 flex-col">
        <NdaCreator standardTerms={standardTerms} />
      </main>
    </>
  );
}
