// The design editor's preview shows the header photo the photographer picks,
// not just the first photo in the library.
import { expect, test } from "@playwright/test";
import sharp from "sharp";

test("choosing a header photo shows it in the editor's preview", async ({ page }) => {
  const id = Date.now().toString(36);
  await page.goto("/signup");
  await page.locator('input[name="name"]').fill("Header Photographer");
  await page.locator('input[name="email"]').fill(`e2e-hero-${id}@example.com`);
  await page.locator('input[name="password"]').fill("a long password");
  await page.locator('input[name="subdomain"]').fill(`e2e-hero-${id}`);
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard/);

  await page.goto("/dashboard/manage/upload");
  const photo = (background: string) =>
    sharp({ create: { width: 1600, height: 1000, channels: 3, background } }).jpeg().toBuffer();
  await page.locator('input[type="file"]').first().setInputFiles([
    { name: "blue.jpg", mimeType: "image/jpeg", buffer: await photo("#446688") },
    { name: "red.jpg", mimeType: "image/jpeg", buffer: await photo("#aa3322") },
  ]);
  await expect(page.getByText("Uploaded 2 photos.")).toBeVisible({ timeout: 60_000 });

  await page.goto("/dashboard/manage/design");
  const preview = page.frameLocator('iframe[title="Site preview"]');
  await expect(page.getByText("Loading preview…")).toBeHidden({ timeout: 30_000 });

  await page.getByRole("button", { name: "Full-width photo" }).first().click();
  const picker = page.getByRole("button", { name: "Automatic (first photo on the page)" }).locator("..");
  const choices = picker.locator("ul button");
  await expect(choices).toHaveCount(2);
  // The picker's photo that isn't the one the preview shows by default.
  const heroImg = preview.locator("section.relative img").first();
  await expect(heroImg).toBeVisible();
  const before = await heroImg.getAttribute("src");
  const srcs = await choices.locator("img").evaluateAll((imgs) => imgs.map((i) => i.getAttribute("src")));
  const other = srcs.findIndex((s) => s !== before);
  expect(other).toBeGreaterThanOrEqual(0);
  await choices.nth(other).click();

  await expect(heroImg).toHaveAttribute("src", srcs[other]!);
  // What the browser actually shows (srcset wins over src).
  await expect
    .poll(() => heroImg.evaluate((img: HTMLImageElement) => img.currentSrc))
    .toContain(srcs[other]!.replace(/-\d+\.webp.*$/, ""));
});
