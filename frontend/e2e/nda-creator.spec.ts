import { expect, test } from "@playwright/test";
import { fillSampleAgreement, NdaPage, sampleAgreement } from "./ndaPage";

let nda: NdaPage;

test.beforeEach(async ({ page }) => {
  nda = new NdaPage(page);
  await nda.goto();
});

test.afterEach(() => {
  expect(nda.errors(), "no console errors or uncaught exceptions").toEqual([]);
});

test.describe("page load", () => {
  test("has a descriptive title and the main regions", async ({ page }) => {
    await expect(page).toHaveTitle("Mutual NDA Creator | Prelegal");
    await expect(page.getByRole("heading", { name: "Agreement details" })).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      nda.preview.getByRole("heading", { level: 1, name: "Mutual Non-Disclosure Agreement", exact: true }),
    ).toBeVisible();
    await expect(nda.downloadButton).toBeEnabled();
  });

  test("is fully server-rendered, including the Standard Terms", async ({ request }) => {
    const html = await (await request.get("/")).text();
    expect(html).toContain("Standard Terms");
    expect(html).toContain("Equitable Relief");
    expect(html).toContain("[Governing Law]");
  });

  test("starts with the template defaults and placeholders", async () => {
    await expect(nda.field("Purpose")).toHaveValue(
      "Evaluating whether to enter into a business relationship with the other party.",
    );
    for (const placeholder of ["[Effective Date]", "[Governing Law]", "[Jurisdiction]"]) {
      await expect(nda.preview.getByText(placeholder, { exact: true })).toBeVisible();
    }
    await expect(nda.preview.getByText("None.", { exact: true })).toBeVisible();
  });

  test("does not load the PDF library until it is needed", async ({ page }) => {
    const scripts = await page.evaluate(() => performance.getEntriesByType("resource").map((r) => r.name));
    const sizes = await Promise.all(
      scripts.filter((s) => s.endsWith(".js")).map(async (s) => (await page.request.get(s)).body()),
    );
    expect(sizes.some((body) => body.includes("pdfkit") || body.includes("@react-pdf"))).toBe(false);
  });
});

test.describe("live preview", () => {
  test("shows every entered value", async () => {
    await fillSampleAgreement(nda);
    const a = sampleAgreement;
    for (const text of [
      a.purpose,
      "October 11, 2026",
      "2 years",
      "3 years",
      a.governingLaw,
      a.jurisdiction,
      a.modifications,
    ]) {
      await expect(nda.preview.getByText(text, { exact: true })).toBeVisible();
    }
    await expect(nda.preview.getByText(/\[[A-Za-z ]+\]/)).toHaveCount(0);
  });

  test("fills the signature table by party", async () => {
    await fillSampleAgreement(nda);
    const table = nda.preview.getByRole("table");
    await expect(table.getByRole("row", { name: /Print Name/ }).getByRole("cell")).toHaveText([
      "Ada Lovelace",
      "Alan Turing",
    ]);
    await expect(table.getByRole("row", { name: /Company/ }).getByRole("cell")).toHaveText(["Acme, Inc.", "Globex"]);
    await expect(table.getByRole("row", { name: /Signature/ }).getByRole("cell")).toHaveText(["", ""]);
  });

  test("reverts to a placeholder when a required field is cleared", async () => {
    await nda.field("Governing Law").fill("Delaware");
    await expect(nda.preview.getByText("Delaware", { exact: true })).toBeVisible();
    await nda.field("Governing Law").fill("");
    await expect(nda.preview.getByText("[Governing Law]", { exact: true })).toBeVisible();
  });

  test("toggles the term options and disables the unused years input", async () => {
    const checks = nda.preview.getByRole("img");
    await expect(checks).toHaveCount(4);

    await nda.form.getByRole("radio", { name: "Continues until terminated" }).check();
    await nda.form.getByRole("radio", { name: "In perpetuity" }).check();
    await expect(nda.field("MNDA term in years")).toBeDisabled();
    await expect(nda.field("Confidentiality term in years")).toBeDisabled();
    expect(await checks.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).toEqual([
      "Unchecked",
      "Checked",
      "Unchecked",
      "Checked",
    ]);
    await expect(nda.preview.getByText("Expires ____ year(s) from Effective Date.")).toBeVisible();

    await nda.form.getByRole("radio", { name: /Expires/ }).check();
    await expect(nda.field("MNDA term in years")).toBeEnabled();
  });

  test("flags an invalid number of years", async () => {
    await nda.field("MNDA term in years").fill("0");
    await expect(nda.preview.getByText("[number of years]")).toBeVisible();
  });

  test("keeps the Download button in view while scrolling the preview", async ({ page }) => {
    await nda.preview.getByText("Equitable Relief", { exact: true }).scrollIntoViewIfNeeded();
    await expect(nda.downloadButton).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  });
});

test.describe("PDF download", () => {
  test("downloads the completed agreement with every value filled in", async () => {
    await fillSampleAgreement(nda);
    const pdf = await nda.downloadPdf();

    expect(pdf.filename).toBe("Mutual-NDA-Acme-Inc-Globex.pdf");
    expect(pdf.title).toBe("Mutual Non-Disclosure Agreement");
    const cover = pdf.pages[0];
    for (const text of [
      sampleAgreement.purpose,
      "October 11, 2026",
      "Expires 2 years from Effective Date.",
      "3 years from Effective Date",
      "Governing Law: Delaware",
      "Jurisdiction: courts located in New Castle, DE",
      "Section 8 is deleted.",
      "Ada Lovelace",
      "Alan Turing",
      "Acme, Inc.",
      "Globex",
      "ada@acme.test",
      "1 Main St",
      "Springfield, IL",
    ]) {
      expect(cover).toContain(text);
    }
    expect(pdf.pages[1]).toMatch(/^Standard Terms 1\. Introduction/);
    pdf.pages.forEach((text, i) => expect(text).toMatch(new RegExp(`Page ${i + 1} of ${pdf.pages.length}$`)));
  });

  test("downloads a blank agreement with placeholders and a generic filename", async () => {
    const pdf = await nda.downloadPdf();
    expect(pdf.filename).toBe("Mutual-NDA.pdf");
    expect(pdf.pages[0]).toContain("[Effective Date]");
    expect(pdf.pages[0]).toContain("[Governing Law]");
  });

  test("reflects changes made after a previous download", async () => {
    await nda.field("Governing Law").fill("Delaware");
    expect((await nda.downloadPdf()).pages[0]).toContain("Governing Law: Delaware");
    await nda.field("Governing Law").fill("California");
    expect((await nda.downloadPdf()).pages[0]).toContain("Governing Law: California");
  });

  test("shows progress and ignores repeat clicks while generating", async ({ page }) => {
    // Hold back the lazily loaded PDF chunks so the in-progress state is observable.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/_next/static/**/*.js", async (route) => {
      await gate;
      await route.continue();
    });
    const downloads: string[] = [];
    page.on("download", (d) => downloads.push(d.suggestedFilename()));

    await nda.downloadButton.click();
    const busy = page.getByRole("button", { name: "Generating…" });
    await expect(busy).toBeDisabled();
    await busy.click({ force: true });

    const download = page.waitForEvent("download");
    release();
    await download;
    await expect(nda.downloadButton).toBeEnabled();
    await page.waitForTimeout(500);
    expect(downloads).toEqual(["Mutual-NDA.pdf"]);
  });

  test("moves the signature block to page 2 when the cover page overflows", async () => {
    await nda.field("Modifications").fill("A long modification. ".repeat(60));
    const { pages } = await nda.downloadPdf();
    expect(pages[0]).not.toContain("By signing this Cover Page");
    expect(pages[1]).toMatch(/^By signing this Cover Page/);
    expect(pages[1]).toContain("PARTY 1");
  });
});

test.describe("keyboard", () => {
  test("can fill the form and download using only the keyboard", async ({ page }) => {
    await page.keyboard.press("Tab");
    await expect(nda.field("Purpose")).toBeFocused();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Keyboard purpose.");
    await page.keyboard.press("Tab");
    await expect(nda.field("Effective Date")).toBeFocused();

    // Tab forward to Governing Law, checking the order of the fields on the way.
    const order: string[] = [];
    for (
      let i = 0;
      i < 12 && !(await nda.field("Governing Law").evaluate((el) => el === document.activeElement));
      i++
    ) {
      await page.keyboard.press("Tab");
      order.push(
        await page.evaluate(
          () => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.id ?? "",
        ),
      );
    }
    await expect(nda.field("Governing Law")).toBeFocused();
    expect(order).toContain("MNDA term in years");
    expect(order).toContain("Confidentiality term in years");
    await page.keyboard.type("Delaware");

    await expect(nda.preview.getByText("Keyboard purpose.", { exact: true })).toBeVisible();
    await expect(nda.preview.getByText("Delaware", { exact: true })).toBeVisible();

    await nda.downloadButton.focus();
    const [download] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);
    expect(download.suggestedFilename()).toBe("Mutual-NDA.pdf");
  });

  test("changes term options with the arrow keys", async ({ page }) => {
    const expires = nda.form.getByRole("radio", { name: /Expires/ });
    await expires.focus();
    await page.keyboard.press("ArrowDown");
    await expect(nda.form.getByRole("radio", { name: "Continues until terminated" })).toBeChecked();
    await expect(nda.field("MNDA term in years")).toBeDisabled();
  });

  test("shows a focus ring with at least 3:1 contrast against the page (WCAG 1.4.11)", async ({ page }) => {
    await nda.field("Purpose").focus();
    await page.keyboard.press("Tab"); // keyboard focus, so :focus-visible styles apply
    await expect(nda.field("Effective Date")).toBeFocused();

    const contrast = await nda.field("Effective Date").evaluate((el) => {
      // The ring is the 2px box-shadow; resolve its colour (which may be in lab()) to sRGB via a canvas pixel.
      const ring = getComputedStyle(el)
        .boxShadow.split(/,(?![^(]*\))/)
        .find((s) => / 0px 0px 0px 2px/.test(s))!;
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.fillStyle = ring.replace(/ 0px 0px 0px 2px.*/, "").trim();
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data).map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return 1.05 / (luminance + 0.05); // against white
    });
    expect(contrast).toBeGreaterThanOrEqual(3);
  });
});

test.describe("responsive layout", () => {
  test("keeps the years inputs compact so each term option reads on one line", async () => {
    for (const label of ["MNDA term in years", "Confidentiality term in years"]) {
      expect((await nda.field(label).boundingBox())!.width).toBeLessThan(100);
    }
    const option = nda.form.getByRole("radio", { name: /Expires/ }).locator("xpath=..");
    expect((await option.boundingBox())!.height).toBeLessThan(50);
  });

  test("wraps long unbroken input instead of overflowing the page", async ({ page }) => {
    await nda
      .party(1)
      .getByLabel("Company")
      .fill("Supercalifragilistic-Holdings-International-Incorporated-Limited-LLC");
    await nda
      .party(2)
      .getByLabel("Notice Address")
      .fill(`${"very".repeat(20)}@an-extremely-long-domain-name.test`);
    await nda.field("Modifications").fill("x".repeat(300));
    const table = nda.preview.getByRole("table");
    expect(await table.evaluate((t) => t.scrollWidth <= t.clientWidth)).toBe(true);
    expect(await nda.preview.evaluate((a) => a.scrollWidth <= a.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("shows the form beside the preview on desktop", async () => {
    const formBox = (await nda.form.boundingBox())!;
    const previewBox = (await nda.preview.boundingBox())!;
    expect(previewBox.x).toBeGreaterThan(formBox.x + formBox.width - 1);
  });

  test("stacks the form above the preview on a phone without horizontal scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const formBox = (await nda.form.boundingBox())!;
    const previewBox = (await nda.preview.boundingBox())!;
    expect(previewBox.y).toBeGreaterThan(formBox.y + formBox.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

    await nda.field("Governing Law").fill("Delaware");
    await expect(nda.preview.getByText("Delaware", { exact: true })).toBeAttached();
    const pdf = await nda.downloadPdf();
    expect(pdf.pages[0]).toContain("Governing Law: Delaware");
  });
});

test.describe("links", () => {
  test("open external references in a new tab", async () => {
    for (const name of ["commonpaper.com/standards/mutual-nda/1.0", "CC BY 4.0"]) {
      const link = nda.preview.getByRole("link", { name }).first();
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
});
