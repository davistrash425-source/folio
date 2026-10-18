// Every server action that changes an account must refuse people who aren't
// signed in. The list below is checked against the real files, so adding an
// action without deciding who may call it fails the tests.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import path from "path";
import * as authActions from "../app/actions/auth.ts";
import * as designActions from "../app/actions/design.ts";
import * as siteActions from "../app/actions/site.ts";
import { DATA_DIR, deleteUser } from "../lib/db.ts";
import { presetDesign } from "../lib/design.ts";
import { filesOf, formOf, formWith, jpegFile, makeUser, redirectedTo, resetRequest, signInAs, signOut } from "./helpers.ts";

beforeEach(resetRequest);

const dbText = () => readFileSync(path.join(DATA_DIR, "db.json"), "utf8");

// Actions that need a signed-in user, each called with realistic input.
const needSignIn: Record<string, () => Promise<unknown>> = {
  uploadPhotos: async () => siteActions.uploadPhotos({}, formWith(await jpegFile())),
  deletePhoto: () => siteActions.deletePhoto("some-id"),
  reorderPhotos: () => siteActions.reorderPhotos(["some-id"]),
  updatePhoto: () =>
    siteActions.updatePhoto("some-id", { description: "hacked", location: "", alt: "", albumIds: [] }),
  setPublished: () => siteActions.setPublished(false),
  saveProfile: () => siteActions.saveProfile({}, formOf({ name: "Hacked" })),
  createAlbum: () => siteActions.createAlbum({}, formOf({ title: "Hacked" })),
  updateAlbum: () => siteActions.updateAlbum("some-id", {}, formOf({ title: "Hacked" })),
  setAlbumPhotos: () => siteActions.setAlbumPhotos("some-id", ["some-photo"]),
  setAlbumCover: () => siteActions.setAlbumCover("some-id", "some-photo"),
  deleteAlbum: () => siteActions.deleteAlbum("some-id"),
  setInquiryRead: () => siteActions.setInquiryRead("some-id", true),
  deleteInquiry: () => siteActions.deleteInquiry("some-id"),
  saveDraftDesign: () => designActions.saveDraftDesign(presetDesign("index", "noir")),
  publishDesign: () => designActions.publishDesign(presetDesign("index", "noir")),
  undoDesign: () => designActions.undoDesign(),
  discardDraftDesign: () => designActions.discardDraftDesign(),
  resendVerification: () => authActions.resendVerification(),
  deleteAccount: () => authActions.deleteAccount({}, formOf({ password: "anything" })),
};

// Actions anyone may call: visitors leaving a message, and the sign-in forms.
const open = ["sendInquiry", "signup", "login", "logout", "requestPasswordReset", "resetPassword"];

test("every server action is listed here as needing a login or as open to everyone", () => {
  const exported = [...Object.keys(siteActions), ...Object.keys(designActions), ...Object.keys(authActions)];
  assert.deepEqual(exported.sort(), [...Object.keys(needSignIn), ...open].sort());
});

for (const [name, call] of Object.entries(needSignIn)) {
  test(`${name} sends signed-out visitors to the login page and changes nothing`, async () => {
    const someone = await makeUser("Someone");
    await siteActions.setPublished(true).catch(() => {}); // signed out: harmless, makes sure the database exists
    signOut();
    const before = dbText();
    const files = filesOf(someone.id);

    assert.equal(await redirectedTo(call()), "/login");
    assert.equal(dbText(), before);
    assert.deepEqual(filesOf(someone.id), files);
  });

  test(`${name} also refuses a login cookie left over from a deleted account`, async () => {
    const ghost = await makeUser("Ghost");
    await signInAs(ghost);
    await deleteUser(ghost.id);
    const before = dbText();

    assert.equal(await redirectedTo(call()), "/login");
    assert.equal(dbText(), before);
    assert.deepEqual(filesOf(ghost.id), [], "files saved for a deleted account");
  });
}
