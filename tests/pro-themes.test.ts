// The extra theme settings are part of Folio Pro: Free accounts can save the
// basic ones, and the server puts the Pro ones back to the defaults.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { publishDesign, saveDraftDesign } from "../app/actions/design.ts";
import { updateUser } from "../lib/db.ts";
import { defaultThemeSettings, presetDesign, readDesign, type SiteDesign } from "../lib/design.ts";
import { makeUser, resetRequest, signInAs } from "./helpers.ts";

beforeEach(resetRequest);

// A design that changes one basic and one Pro setting of every theme.
function customised(): SiteDesign {
  const d = presetDesign("exhibition");
  return {
    ...d,
    themeSettings: {
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
