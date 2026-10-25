// The dashboard's five steps (lib/steps.ts) and where /dashboard sends people.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { completedSteps, entryPath } from "../lib/steps.ts";
import { findUserById, updateUser } from "../lib/db.ts";
import { addAlbum, addPhoto, makeUser, resetRequest } from "./helpers.ts";

beforeEach(resetRequest);

test("the five steps tick off as a site comes together", async () => {
  const davi = await makeUser("Davi", { published: false });
  // A fresh draft: nothing uploaded, but the design has no unpublished changes.
  assert.deepEqual(completedSteps(davi), [false, false, false, true, false]);

  const { photo } = await addPhoto(davi.id);
  assert.deepEqual(completedSteps((await findUserById(davi.id))!), [true, false, false, true, false]);

  await updateUser(davi.id, (u) => (u.photos.find((p) => p.id === photo.id)!.description = "Dunes"));
  assert.equal(completedSteps((await findUserById(davi.id))!)[1], true, "describing a photo ticks step 2");

  await addAlbum(davi.id, "Desert");
  assert.equal(completedSteps((await findUserById(davi.id))!)[2], true, "an album ticks step 3");

  await updateUser(davi.id, (u) => (u.published = true));
  assert.deepEqual(completedSteps((await findUserById(davi.id))!), [true, true, true, true, true]);
});

test("a site that isn't confirmed never counts as live", async () => {
  const fran = await makeUser("Fran", { verified: false });
  await updateUser(fran.id, (u) => (u.published = true));
  assert.equal(completedSteps((await findUserById(fran.id))!)[4], false);
});

test("the dashboard front door sends new photographers to upload and everyone else to their library", () => {
  assert.equal(entryPath({ photos: [] }), "/dashboard/manage/upload");
  assert.equal(entryPath({ photos: [{}] }), "/dashboard/manage/photos");
});
