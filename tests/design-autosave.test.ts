// Autosaving the design draft: undo steps stay useful, and the public site's
// cache is left alone until something is published.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { publishDesign, saveDraftDesign, undoDesign } from "../app/actions/design.ts";
import { findUserById } from "../lib/db.ts";
import { presetDesign, type SiteDesign } from "../lib/design.ts";
import { countChanges } from "../app/dashboard/design/changes.ts";
import { makeUser, resetRequest, signInAs } from "./helpers.ts";
import { revalidated } from "./stubs/next-cache.ts";

beforeEach(resetRequest);

const titled = (title: string): SiteDesign => {
  const d = presetDesign();
  return { ...d, pages: d.pages.map((p, i) => (i === 1 ? { ...p, title } : p)) };
};

test("autosaves close together make one undo step", async (t) => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });

  await saveDraftDesign(titled("A"), { autosave: true });
  t.mock.timers.tick(5_000);
  await saveDraftDesign(titled("Ab"), { autosave: true });
  t.mock.timers.tick(5_000);
  const last = await saveDraftDesign(titled("Abc"), { autosave: true });
  assert.equal((await findUserById(alice.id))?.designHistory?.length, 1);
  assert.equal(last.canUndo, true);

  const undone = await undoDesign();
  assert.equal(undone.draft?.pages[1].title, presetDesign().pages[1].title, "back to before the burst");
  assert.equal(undone.canUndo, false);
});

test("an autosave long after the last step starts a new undo step", async (t) => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });

  await saveDraftDesign(titled("First"), { autosave: true });
  t.mock.timers.tick(31_000);
  await saveDraftDesign(titled("Second"), { autosave: true });
  assert.equal((await findUserById(alice.id))?.designHistory?.length, 2);

  assert.equal((await undoDesign()).draft?.pages[1].title, "First");
});

test("after an undo, the next autosave is a new undo step", async (t) => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });

  await saveDraftDesign(titled("First"), { autosave: true });
  t.mock.timers.tick(31_000);
  await saveDraftDesign(titled("Second"), { autosave: true });
  await undoDesign();
  t.mock.timers.tick(1_000);
  await saveDraftDesign(titled("Third"), { autosave: true });
  assert.equal((await undoDesign()).draft?.pages[1].title, "First");
});

test("saves that aren't autosaves always make their own undo step", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  await saveDraftDesign(titled("One"));
  await saveDraftDesign(titled("Two"));
  assert.equal((await findUserById(alice.id))?.designHistory?.length, 2);
});

test("saving a draft leaves the public site's cache alone; publishing refreshes it", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const tag = `tag:site:${alice.subdomain}`;

  revalidated.length = 0;
  await saveDraftDesign(titled("Draft"), { autosave: true });
  await undoDesign();
  assert.ok(!revalidated.includes(tag), "draft saves don't clear the public cache");
  assert.ok(revalidated.includes("path:/dashboard"), "the dashboard still refreshes");

  revalidated.length = 0;
  await publishDesign(titled("Live"));
  assert.ok(revalidated.includes(tag), "publishing does");
});

test("the editor counts each unpublished change once", () => {
  const live = presetDesign();
  assert.equal(countChanges(live, live), 0);
  assert.equal(countChanges({ ...live, fonts: live.fonts === "serif" ? "sans" : "serif" }, live), 1, "a setting");
  assert.equal(countChanges(titled("New name"), live), 1, "a page's name");
  const extra = { ...live, pages: [...live.pages, { ...live.pages[1], id: "extra", slug: "extra" }] };
  assert.equal(countChanges(extra, live), 1, "an added page");
  assert.equal(countChanges(live, extra), 1, "a removed page");
  const home = live.pages[0];
  const fewer = { ...live, pages: [{ ...home, sections: home.sections.slice(1) }, ...live.pages.slice(1)] };
  assert.equal(countChanges(fewer, live), 1, "a removed section");
  assert.equal(countChanges({ ...fewer, fonts: live.fonts === "serif" ? "sans" : "serif" }, live), 2, "two changes");
});
