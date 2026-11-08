// Every theme can show the "Book a date" section. Rendering a whole theme in
// plain Node needs the full site fixture and client-only imports, so these
// checks read the theme sources: each one has a booking case, and each theme
// that draws its own section checks site.bookingsOpen before showing the form.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const THEMES_DIR = join(process.cwd(), "app", "sites", "[subdomain]", "themes");

// Themes that draw their own wrapper around the form (so they guard it themselves).
const OWN_WRAPPER = ["tag", "studio", "mosaic", "monograph", "index-theme", "filmstrip", "exhibition", "contactsheet"];

function themeSource(name: string) {
  return readFileSync(join(THEMES_DIR, `${name}.tsx`), "utf8");
}

for (const name of OWN_WRAPPER) {
  test(`the ${name} theme has a booking section case`, () => {
    assert.match(themeSource(name), /case "booking"/);
  });

  test(`the ${name} theme only shows its booking form when bookings are open`, () => {
    assert.match(themeSource(name), /if \(!site\.bookingsOpen\) return null;/);
  });

  test(`the ${name} theme puts the booking form inside its own section`, () => {
    assert.match(themeSource(name), /<BookingForm subdomain=\{site\.subdomain\} preview=\{site\.preview\} \/>/);
  });
}

test("the classic theme uses the shared booking section", () => {
  assert.match(themeSource("classic"), /case "booking"/);
  assert.match(themeSource("classic"), /<BookingSection site=\{site\} title=\{section\.title \|\| "Book a date"\} \/>/);
});
