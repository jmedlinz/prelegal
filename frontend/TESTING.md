# Testing the Mutual NDA Creator

Testing is done in **Google Chrome only**. Non-Latin characters (CJK, emoji) in the PDF are knowingly out of scope;
the built-in PDF fonts cannot render them.

## Automated tests

| Command | What it runs |
|---|---|
| `npm test` | Unit and component tests (Vitest, under 15 s) |
| `npm run test:coverage` | The same tests with a coverage report (`coverage/index.html`) |
| `npm run test:e2e` | Production build, then end-to-end tests in Chrome (Playwright, about 30 s) |
| `npm run test:all` | All of the above |

The GitHub Actions workflow `.github/workflows/frontend.yml` runs lint, type checking, the unit and component tests,
and the e2e suite on every pull request that touches `frontend/` or `templates/`.

### What each layer covers

**Unit tests** (`src/lib/nda/*.test.ts`, Node)
- `markdown.test.ts`: template parsing edge cases (adjacent tokens, CRLF, unmatched markup). Also checks the real
  `templates/Mutual-NDA.md`: all 11 sections, every cover-page reference, no leftover markup, every word kept.
- `build.test.ts`: the Cover Page builder. Covers section order, every field, placeholders for blank or
  whitespace-only input, both options of each term, year-count validation, the signature table, links and
  attribution, date formatting (including years 0001–0099), and safe filenames.

**PDF tests** (`src/components/NdaPdf.test.tsx`, Node). These render real PDFs and read them back with pdf.js. They
check:
- the title metadata and that every entered value appears;
- the cover page fits on page 1 and the Standard Terms start on page 2;
- a "Page N of M" footer appears on every page;
- the signing statement and table move to the next page together;
- no automatic hyphenation;
- long unbroken input wraps inside the margins.

**Component tests** (`src/components/*.test.tsx`, jsdom with React Testing Library)
- `NdaForm`: defaults, labelled groups, hints exposed as accessible descriptions, typing into every field, radio
  options enabling and disabling the years inputs, party columns updated independently, no page reload on submit.
- `NdaPreview`: heading levels, value and placeholder highlighting, checkbox state for screen readers, table header
  scopes, safe external links.
- `NdaCreator`: the preview updates live from the form, and the filename follows the company names.
- `DownloadPdfButton`, with the PDF library mocked: the filename, the busy state, object-URL cleanup, the error
  message (announced with `role="alert"`), retrying, and using the latest document.

**End-to-end tests** (`e2e/`, Playwright in Chrome against the production build)
- `nda-creator.spec.ts`:
  - page load, server-rendered Standard Terms, and the PDF library not loading until it's needed;
  - the live preview;
  - real downloads, parsed with pdf.js;
  - progress and repeat-click handling;
  - keyboard-only use;
  - focus-ring contrast of at least 3:1;
  - desktop and phone layouts, with no horizontal overflow from long input;
  - no console errors in any test.
- `accessibility.spec.ts`: axe scans (WCAG 2.2 AA plus best practices) on first load, with the form filled in, and on
  a phone-sized screen.

## Manual test plan

These checks cover what automation can't judge well: visual quality, the PDF as it appears in Chrome's viewer, and
how the app feels to use. Run them against `npm run build && npm start`.

| ID | Check | Steps | Expected |
|---|---|---|---|
| MT-01 | First impression | Open the app at a desktop size. | Form on the left, paper-style preview on the right. Each term option reads on one line. Placeholders are highlighted in amber. |
| MT-02 | Live preview of a full agreement | Fill every field, including a two-line notice address. | Each value appears in the right place and is highlighted in blue. Party details are in the correct columns. No placeholders remain. |
| MT-03 | Date entry | Click Effective Date and type `10112026`. | The field shows 10/11/2026 and the preview shows "October 11, 2026". |
| MT-04 | PDF in Chrome's viewer | Download, then open the file in Chrome. | Title "Mutual Non-Disclosure Agreement", 3 pages, the cover page on page 1, checkboxes ticked correctly, the link unbroken, a footer on every page. |
| MT-05 | Phone layout (375 px) | Narrow the viewport and scroll the page. | The form stacks above the preview, nothing scrolls sideways, and the Download button stays reachable. |
| MT-06 | Zoomed or narrow desktop (640 px, about 200% zoom) | As MT-05. | The layout reflows with no clipping or sideways scrolling. |
| MT-07 | Keyboard focus | Tab through the form. | Every field shows a clearly visible dark-blue focus ring, and the order follows the visual layout. |
| MT-08 | Long and unbroken input | Enter a 70-character company name, an 80-character email address, and multi-line modifications. | Text wraps inside the preview and the PDF table cells. Blank lines are kept, and nothing spills past the page edge. |
| MT-09 | Download failure | Force PDF generation to fail (e.g. stub `URL.createObjectURL` in DevTools). | A red message, "Could not generate the PDF. Please try again.", appears next to the button, and the button can be used again. |

### Results: 2026-10-11, Chrome 155, Windows 11

The initial run found five problems. Each was fixed and now has an automated regression test.

| ID | Result | Notes |
|---|---|---|
| MT-01 | Pass after fix | **Bug:** the years inputs stretched to full width, so "year(s) from Effective Date" wrapped onto three lines (a Tailwind `w-full`/`w-20` conflict). Fixed, with an e2e layout test. |
| MT-02 | Pass | The sticky Download bar stays visible while scrolling the preview. |
| MT-03 | Pass | |
| MT-04 | Pass after fix | **Bug:** react-pdf hyphenated the URL as "common-" / "paper.com/…". Automatic hyphenation is now off. Covered by a PDF test. Note: the browser extension can't scroll inside Chrome's PDF viewer, so pages 2–3 were inspected by rendering the PDF to images and are also checked by the automated text tests. |
| MT-05 | Pass | 375 px: no sideways scrolling, and the sticky Download button is reachable. "year(s) from Effective Date" wraps to two lines, which is acceptable. |
| MT-06 | Pass | 640 px: clean reflow. |
| MT-07 | Pass after fix | **Bug:** the focus ring (`sky-200`) had 1.33:1 contrast against white, below the 3:1 that WCAG 1.4.11 requires. It is now `sky-700`. Covered by an e2e contrast test. |
| MT-08 | Pass after fix | **Bugs:** (1) long unbroken text spilled out of preview table cells and made the page scroll sideways; fixed with `overflow-wrap: anywhere`. (2) In the PDF it ran past the page edge; long tokens now get hyphen-free break points. Both are covered by tests. |
| MT-09 | Pass after fix | **Gap:** the error message wasn't announced to screen readers. It now uses `role="alert"`, which a component test checks. |

The automated axe scan separately found that the page had no `<main>` landmark. That has also been fixed.
