// What protects photographers' rights on their sites: their name and
// copyright notice inside every web copy, the footer's copyright line, and
// asking AI training crawlers to stay away.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { saveAiTraining, saveProfile, uploadPhotos } from "../app/actions/site.ts";
import robots from "../app/robots.ts";
import { siteMetadata } from "../app/sites/[subdomain]/metadata.ts";
import { findUserById, updateUser } from "../lib/db.ts";
import { processImage, variantName } from "../lib/images.ts";
import { siteData } from "../lib/public-site.ts";
import { AI_TRAINING_CRAWLERS } from "../lib/site.ts";
import { copyrightLine } from "../lib/site-data.ts";
import { photoRights, storage } from "../lib/uploads.ts";
import { finishUpload, formOf, formWith, jpegFile, makeUser, resetRequest, signInAs } from "./helpers.ts";
import { requestHeaders } from "./stubs/next-headers.ts";

beforeEach(resetRequest);

// What a served web copy says about who made it.
async function rightsIn(data: Buffer) {
  const meta = await sharp(data).metadata();
  return { exif: meta.exif?.toString("latin1") ?? "", xmp: meta.xmp?.toString("utf8") ?? "" };
}

test("web copies carry the photographer's name and notice, and still nothing else from the original", async () => {
  const input = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#888" } })
    .withExif({ IFD0: { Make: "TestCam", Copyright: "old notice" } })
    .jpeg()
    .toBuffer();
  const { variants } = await processImage(input, { artist: "José Núñez", copyright: "© 2026 José Núñez <studio>" });
  for (const v of variants) {
    const { exif, xmp } = await rightsIn(v.data);
    assert.match(exif, /Jose Nunez/, "EXIF holds plain letters");
    assert.match(exif, /\(C\) 2026 Jose Nunez/);
    assert.doesNotMatch(exif, /TestCam|old notice/);
    assert.match(xmp, /<dc:creator><rdf:Seq><rdf:li>José Núñez<\/rdf:li>/, "XMP keeps every character");
    assert.match(xmp, /© 2026 José Núñez &lt;studio&gt;/, "and is escaped");
  }
});

test("photoRights uses the photographer's own line, or © year and name", () => {
  assert.deepEqual(photoRights({ name: " Jane  Doe " }, 2025), {
    artist: "Jane Doe",
    copyright: "© 2025 Jane Doe. All rights reserved.",
  });
  assert.equal(photoRights({ name: "Jane", copyrightLine: "Jane Doe Studio, all rights reserved" }).copyright, "Jane Doe Studio, all rights reserved");
});

test("photos uploaded either way carry their photographer's name and notice", async () => {
  const alice = await makeUser("Alice");
  await updateUser(alice.id, (u) => {
    u.profile.copyrightLine = "© Alice Studio";
  });
  await signInAs(alice);
  await uploadPhotos({}, formWith(await jpegFile()));
  const file = `${randomUUID()}.orig.jpg`;
  await storage.put(alice.id, file, Buffer.from(await (await jpegFile()).arrayBuffer()));
  await finishUpload(file); // the direct-upload path

  const photos = (await findUserById(alice.id))!.photos;
  assert.equal(photos.length, 2);
  for (const photo of photos) {
    assert.equal(photo.copyright, "© Alice Studio");
    const { xmp } = await rightsIn(await storage.get(alice.id, variantName(photo.id, photo.variants![0])));
    assert.match(xmp, /© Alice Studio/);
    assert.match(xmp, /<rdf:li>Alice<\/rdf:li>/);
  }
});

test("the footer shows the photographer's copyright line, saved on one line, or © and their name", async () => {
  const alice = await makeUser("Alice");
  assert.equal(copyrightLine(siteData(alice)!.profile), "© Alice");
  await signInAs(alice);
  await saveProfile({}, formOf({ name: "Alice", copyrightLine: "  © 2026 Alice\nAll rights reserved " }));
  assert.equal(copyrightLine(siteData((await findUserById(alice.id))!)!.profile), "© 2026 Alice All rights reserved");
});

test("a site asks AI training crawlers to stay away unless its photographer allows them", async () => {
  const alice = await makeUser("Alice");
  requestHeaders.set("host", `${alice.subdomain}.localhost:3000`);
  const blocked = await robots();
  assert.deepEqual(blocked.rules, [
    { userAgent: AI_TRAINING_CRAWLERS, disallow: "/" },
    { userAgent: "*", allow: "/" },
  ]);
  for (const bot of ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot"]) assert.ok(AI_TRAINING_CRAWLERS.includes(bot), bot);
  for (const bot of ["Googlebot", "Bingbot"]) assert.ok(!AI_TRAINING_CRAWLERS.includes(bot), `${bot} is a search engine`);
  assert.deepEqual(siteMetadata(alice.subdomain, siteData(alice)).other, { robots: "noai, noimageai" });

  await signInAs(alice);
  await saveAiTraining({}, formOf({})); // the box unticked
  const allowing = (await findUserById(alice.id))!;
  assert.equal(allowing.allowAiTraining, true);
  assert.deepEqual((await robots()).rules, { userAgent: "*", allow: "/" });
  assert.equal(siteMetadata(alice.subdomain, siteData(allowing)).other, undefined);

  await saveAiTraining({}, formOf({ blockAi: "yes" }));
  assert.equal((await findUserById(alice.id))!.allowAiTraining, false);
});
