// Where /dashboard sends people (lib/steps.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { entryPath } from "../lib/steps.ts";

test("the dashboard front door sends new photographers to upload and everyone else to their library", () => {
  assert.equal(entryPath({ photos: [] }), "/dashboard/manage/upload");
  assert.equal(entryPath({ photos: [{}] }), "/dashboard/manage/photos");
});
