// A new photographer signs up, uploads a photo, edits the design and reaches
// the page where the site goes live.
import { expect, test } from "@playwright/test";
import sharp from "sharp";

test("sign up, upload a photo, design the site and reach Go live", async ({ page }) => {
  const id = Date.now().toString(36);
  await page.goto("/signup");
  await page.locator('input[name="name"]').fill("Test Photographer");
  await page.locator('input[name="email"]').fill(`e2e-${id}@example.com`);
  await page.locator('input[name="password"]').fill("a long password");
  await page.locator('input[name="subdomain"]').fill(`e2e-${id}`);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Please agree to the Terms")).toBeVisible();
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard/);

  await page.goto("/dashboard/manage/upload");
  const jpeg = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#446688" } }).jpeg().toBuffer();
  await page.locator('input[type="file"]').first().setInputFiles({ name: "blue.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await expect(page.getByText("Uploaded 1 photo.")).toBeVisible({ timeout: 60_000 });

  await page.goto("/dashboard/manage/photos");
  await expect(page.locator("img").first()).toBeVisible({ timeout: 30_000 });

  await page.goto("/dashboard/manage/design");
  await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();

  await page.goto("/dashboard/manage/publish");
  await expect(page).toHaveURL(/publish/);
});
