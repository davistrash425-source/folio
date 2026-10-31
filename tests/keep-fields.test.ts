// A failed form save hands back what was typed (app/ui/keep-fields.ts), since
// React resets the form after every action.
import { test } from "node:test";
import assert from "node:assert/strict";
import { keepFields } from "../app/ui/keep-fields.ts";
import { formOf } from "./helpers.ts";

test("after an error the form gets back what was typed, without passwords", async () => {
  type State = { error?: string; ok?: string };
  const save = keepFields(async (_prev: State, data: FormData): Promise<State> =>
    data.get("email") === "bad" ? { error: "Please enter a valid email." } : { ok: "Saved." },
  );
  const failed = await save({}, formOf({ name: "Dana", email: "bad", password: "a long password", $ACTION_ID_x: "" }));
  assert.equal(failed.error, "Please enter a valid email.");
  assert.deepEqual(failed.fields, { name: "Dana", email: "bad" });

  const saved = await save({}, formOf({ name: "Dana", email: "dana@example.com" }));
  assert.deepEqual(saved, { ok: "Saved." }, "a save that worked shows what's saved");
});
