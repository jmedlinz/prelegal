# Prelegal frontend: Mutual NDA Creator

A Next.js app for creating a Mutual Non-Disclosure Agreement from the
[Common Paper Mutual NDA v1.0](https://commonpaper.com/standards/mutual-nda/1.0) templates (CC BY 4.0).
The user fills in the key terms, sees the completed agreement update live, and downloads it as a PDF.

## Getting started

Requires Node.js 20.9+ (developed on Node 24).

```bash
cd frontend
npm install
npm run dev     # http://localhost:3000
```

Other scripts:

```bash
npm test        # Vitest unit tests (document builder, template parsing, PDF smoke test)
npm run lint
npm run build && npm start
```

Run these from `frontend/`. The Standard Terms are read from `../templates/Mutual-NDA.md` at build time,
relative to the working directory.

## How it works

- `src/lib/nda/build.ts` is a pure function. It turns the form data and the parsed Standard Terms into a
  format-neutral document model (`src/lib/nda/types.ts`).
- That model is rendered twice: as HTML for the live preview (`src/components/NdaPreview.tsx`) and as a PDF
  with `@react-pdf/renderer` (`src/components/NdaPdf.tsx`). The PDF library is loaded in the browser only
  when the user clicks **Download PDF**.
- Blank required fields are shown as highlighted `[placeholders]`. Signature and date cells are left blank for
  signing.
