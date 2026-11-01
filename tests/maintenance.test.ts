import { test } from "node:test";
import assert from "node:assert/strict";
import { maintenanceOn, maintenanceResponse, openDuringMaintenance } from "../lib/maintenance.ts";

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

test("the legal pages and report forms stay open on the app during maintenance", () => {
  for (const path of ["/terms", "/privacy", "/copyright", "/report", "/report/copyright", "/terms/"]) {
    assert.equal(openDuringMaintenance(null, path), true, path);
  }
  for (const path of ["/", "/login", "/signup", "/pricing", "/dashboard", "/admin", "/report/other", "/termsx"]) {
    assert.equal(openDuringMaintenance(null, path), false, path);
  }
});

test("photographers' sites stay closed during maintenance, even their legal-looking pages", () => {
  for (const path of ["/", "/terms", "/copyright", "/report"]) {
    assert.equal(openDuringMaintenance("alice", path), false, path);
  }
});

test("the maintenance page links to the pages that stay open", async () => {
  const html = await maintenanceResponse().text();
  for (const path of ["/terms", "/privacy", "/copyright", "/report"]) assert.ok(html.includes(`${path}"`), path);
});
