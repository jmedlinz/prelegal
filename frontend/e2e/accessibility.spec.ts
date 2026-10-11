import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { fillSampleAgreement, NdaPage } from "./ndaPage";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function scan(page: NdaPage["page"]) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
}

test.describe("accessibility (axe, WCAG 2.2 AA)", () => {
  // A full axe scan of the long agreement can take ~30s when the suite runs in parallel.
  test.describe.configure({ timeout: 120_000 });

  test("has no violations on first load", async ({ page }) => {
    await new NdaPage(page).goto();
    expect(await scan(page)).toEqual([]);
  });

  test("has no violations with the form filled in and options toggled", async ({ page }) => {
    const nda = new NdaPage(page);
    await nda.goto();
    await fillSampleAgreement(nda);
    await nda.form.getByRole("radio", { name: "In perpetuity" }).check();
    expect(await scan(page)).toEqual([]);
  });

  test("has no violations on a phone-sized screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await new NdaPage(page).goto();
    expect(await scan(page)).toEqual([]);
  });
});
