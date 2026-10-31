// The extra theme settings are part of Folio Pro: Free accounts can save the
// basic ones, and the server puts the Pro ones back to the defaults.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { publishDesign, saveDraftDesign } from "../app/actions/design.ts";
import { updateUser } from "../lib/db.ts";
import { PRO_THEMES, defaultThemeSettings, presetDesign, readDesign, type SiteDesign } from "../lib/design.ts";
import { makeUser, resetRequest, signInAs } from "./helpers.ts";

beforeEach(resetRequest);

// A design that changes one basic and one Pro setting of every theme.
function customised(): SiteDesign {
  const d = presetDesign("exhibition");
  return {
    ...d,
    themeSettings: {
      ...d.themeSettings,
      exhibition: { wall: "forest", labels: "beside", pro: { frame: "black", printSize: "large", labelFont: "sans" } },
      index: { accent: "#0000ff", sort: "newest", pro: { rowSize: "large", titleCase: "upper", showYear: false } },
      filmstrip: { stock: "mono", frameNumbers: false, pro: { frameSize: "large", border: "none", sprockets: false } },
    },
  };
}

test("a Free account keeps the basic theme settings but not the Pro ones", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const saved = await saveDraftDesign(customised());
  assert.equal(saved.error, undefined);
  const settings = saved.draft!.themeSettings;
  assert.equal(settings.exhibition.wall, "forest");
  assert.equal(settings.exhibition.labels, "beside");
  assert.equal(settings.index.sort, "newest");
  assert.equal(settings.filmstrip.stock, "mono");
  assert.deepEqual(settings.exhibition.pro, defaultThemeSettings().exhibition.pro);
  assert.deepEqual(settings.index.pro, defaultThemeSettings().index.pro);
  assert.deepEqual(settings.filmstrip.pro, defaultThemeSettings().filmstrip.pro);
});

test("a Pro account keeps every theme setting, and publishing shows them", async () => {
  const alice = await makeUser("Alice");
  await updateUser(alice.id, (u) => void (u.plan = "pro"));
  await signInAs(alice);
  const saved = await saveDraftDesign(customised());
  assert.deepEqual(saved.draft!.themeSettings, customised().themeSettings);
  const published = await publishDesign(customised());
  assert.deepEqual(published.published!.themeSettings, customised().themeSettings);
});

test("publishing after a downgrade drops the Pro settings", async () => {
  const alice = await makeUser("Alice");
  await updateUser(alice.id, (u) => void (u.plan = "pro"));
  await signInAs(alice);
  await saveDraftDesign(customised());
  await updateUser(alice.id, (u) => void (u.plan = "free"));
  const published = await publishDesign(customised());
  assert.deepEqual(published.published!.themeSettings.exhibition.pro, defaultThemeSettings().exhibition.pro);
  assert.equal(published.published!.themeSettings.exhibition.wall, "forest");
});

test("a bad Pro value is refused", async () => {
  const alice = await makeUser("Alice");
  await updateUser(alice.id, (u) => void (u.plan = "pro"));
  await signInAs(alice);
  const d = customised();
  const bad = { ...d, themeSettings: { ...d.themeSettings, index: { ...d.themeSettings.index, pro: { ...d.themeSettings.index.pro, rowSize: "huge" } } } };
  assert.ok((await saveDraftDesign(bad)).error);
});

test("a design saved before the Pro settings existed still reads, with the defaults", () => {
  const d = presetDesign("index");
  const { exhibition, index, filmstrip } = d.themeSettings;
  const old = {
    ...d,
    themeSettings: {
      exhibition: { wall: exhibition.wall, labels: exhibition.labels },
      index: { accent: index.accent, sort: index.sort },
      filmstrip: { stock: filmstrip.stock, frameNumbers: filmstrip.frameNumbers },
    },
  };
  assert.deepEqual(readDesign(old, "minimal"), d);
});

test("the Pro themes are only for Pro: a Free account's design falls back to Classic", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  for (const theme of PRO_THEMES) {
    const saved = await saveDraftDesign({ ...presetDesign(theme), look: "editorial" });
    assert.equal(saved.draft!.theme, "classic", `${theme} is not available on Free`);
    assert.equal(saved.draft!.look, "editorial", "the Classic look is untouched");
  }
  const free = await saveDraftDesign(presetDesign("filmstrip"));
  assert.equal(free.draft!.theme, "filmstrip", "the four free themes stay");
});

test("a Pro account can use the Pro themes and keeps their settings", async () => {
  const alice = await makeUser("Alice");
  await updateUser(alice.id, (u) => void (u.plan = "pro"));
  await signInAs(alice);
  const d = presetDesign("contactsheet");
  const design = {
    ...d,
    themeSettings: { ...d.themeSettings, contactsheet: { paper: "dark", columns: 8 }, monograph: { paper: "black", pageNumbers: false } },
  } as SiteDesign;
  const published = await publishDesign(design);
  assert.equal(published.published!.theme, "contactsheet");
  assert.deepEqual(published.published!.themeSettings.contactsheet, { paper: "dark", columns: 8 });
  assert.deepEqual(published.published!.themeSettings.monograph, { paper: "black", pageNumbers: false });
});

test("a site whose owner is no longer Pro can't publish a Pro theme", async () => {
  const alice = await makeUser("Alice");
  await updateUser(alice.id, (u) => void (u.plan = "pro"));
  await signInAs(alice);
  await saveDraftDesign(presetDesign("monograph"));
  await updateUser(alice.id, (u) => void (u.plan = "free"));
  const published = await publishDesign(presetDesign("monograph"));
  assert.equal(published.published!.theme, "classic");
});

test("a Pro account keeps the Tag theme's color and grain", async () => {
  const alice = await makeUser("Alice");
  await updateUser(alice.id, (u) => void (u.plan = "pro"));
  await signInAs(alice);
  const d = presetDesign("tag");
  const published = await publishDesign({ ...d, themeSettings: { ...d.themeSettings, tag: { accent: "#ff4fa3", grain: false } } });
  assert.equal(published.published!.theme, "tag");
  assert.deepEqual(published.published!.themeSettings.tag, { accent: "#ff4fa3", grain: false });
});

test("a design saved before the Tag theme existed reads with its defaults", () => {
  const d = presetDesign("classic");
  const older: Partial<SiteDesign["themeSettings"]> = { ...d.themeSettings };
  delete older.tag;
  assert.deepEqual(readDesign({ ...d, themeSettings: older }, "minimal").themeSettings.tag, defaultThemeSettings().tag);
});

test("a Tag color that isn't a hex color is refused", async () => {
  const alice = await makeUser("Alice");
  await updateUser(alice.id, (u) => void (u.plan = "pro"));
  await signInAs(alice);
  const d = presetDesign("tag");
  assert.ok((await saveDraftDesign({ ...d, themeSettings: { ...d.themeSettings, tag: { accent: "lime", grain: true } } })).error);
});

test("a bad Pro theme setting is refused", async () => {
  const alice = await makeUser("Alice");
  await updateUser(alice.id, (u) => void (u.plan = "pro"));
  await signInAs(alice);
  const d = presetDesign("contactsheet");
  const bad = { ...d, themeSettings: { ...d.themeSettings, contactsheet: { paper: "light", columns: 5 } } };
  assert.ok((await saveDraftDesign(bad)).error);
});
