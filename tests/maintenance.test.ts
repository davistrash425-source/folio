import { test } from "node:test";
import assert from "node:assert/strict";
import { maintenanceOn, maintenanceResponse } from "../lib/maintenance.ts";

test("maintenance mode is off unless MAINTENANCE_MODE is switched on", () => {
  assert.equal(maintenanceOn({}), false);
  assert.equal(maintenanceOn({ MAINTENANCE_MODE: "" }), false);
  assert.equal(maintenanceOn({ MAINTENANCE_MODE: "0" }), false);
  assert.equal(maintenanceOn({ MAINTENANCE_MODE: "false" }), false);
  assert.equal(maintenanceOn({ MAINTENANCE_MODE: "1" }), true);
  assert.equal(maintenanceOn({ MAINTENANCE_MODE: " TRUE " }), true);
  assert.equal(maintenanceOn({ MAINTENANCE_MODE: "on" }), true);
});

test("the maintenance page is a temporary, uncached 503", async () => {
  const response = maintenanceResponse();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "3600");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(await response.text(), /back soon/);
});
