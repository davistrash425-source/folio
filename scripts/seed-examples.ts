// Creates the three example sites (bronco, highsierra, streetlight) from the
// photos in folio-homepage-photos/{Bronco,mountain,Street}/ (git-ignored).
// Each is an ordinary account with a made-up photographer, no password and a
// Pro plan, marked as an example on the page itself.
//
//   FOLIO_KEEP_DATA_DIR=1 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
//     --import ./tests/setup.ts scripts/seed-examples.ts
//
// (tests/setup.ts supplies the stand-ins for next/cache, which lib/db.ts imports.)
// Writes to wherever the app is pointed: FOLIO_DATA_DIR locally, or DATABASE_URL
// and the R2_* variables for a real deployment. Set EXAMPLES_OWNER_EMAIL to a
// login email and the sites become that account's extra sites, so it can open
// and edit them from the site switcher. Sites that already exist are skipped.
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { createUser, findUserByEmail, findUserBySubdomain, updateUser, type Photo } from "../lib/db.ts";
import { designSchema, presetDesign, type SiteDesign } from "../lib/design.ts";
import { OPERATOR_NAME } from "../lib/legal.ts";
import { database } from "../lib/pg.ts";
import { storage, storePhoto } from "../lib/uploads.ts";

type Shot = {
  file: string; // inside the example's folder
  description: string; // also the alt text
  location?: string;
  caption?: boolean; // shown under the photo on the site; the rest stay unshown
};

type Example = {
  subdomain: string;
  folder: string;
  name: string; // the made-up photographer
  location: string;
  bio: string;
  design: (design: SiteDesign) => SiteDesign;
  shots: Shot[]; // in display order
};

const EXAMPLE_NOTE = "An example site made with Folio";

const EXAMPLES: Example[] = [
  {
    subdomain: "bronco",
    folder: "Bronco",
    name: "Dale Whitfield",
    location: "Denver, Colorado",
    bio:
      "Dale Whitfield is an example photographer, made up to show what a Folio site can look like.\n\n" +
      "Night Shift is a series about one classic Ford Bronco, photographed after midnight on an empty parking deck: sodium light, wet paint and a lot of patience.",
    design: (d) => ({
      ...d,
      theme: "contactsheet",
      colors: { background: "#0b0b0c", text: "#e8e6e1", muted: "#8a8780", accent: "#e8a13a" },
      fonts: "mixed",
      themeSettings: { ...d.themeSettings, contactsheet: { paper: "dark", columns: 4 } },
    }),
    shots: [
      { file: "Ford pics jpeg (9 of 16).jpg", description: "A cream and rust-orange Bronco facing the camera on a dark parking deck, headlights amber.", caption: true },
      { file: "Ford pics jpeg (2 of 16).jpg", description: "A red and white Bronco parked in the middle of an empty deck, one street lamp behind it." },
      { file: "Ford pics jpeg (15 of 16).jpg", description: "The driver's door and mirror in brown and cream paint, beaded with dew.", caption: true },
      { file: "Ford pics jpeg (8 of 16).jpg", description: "The tailgate with its blue Ford oval, a red taillight glowing at the edge.", caption: true },
      { file: "Ford pics jpeg (1 of 16).jpg", description: "A dark Bronco at the far end of the deck, lit by city lights beyond the wall." },
      { file: "Ford pics jpeg (12 of 16).jpg", description: "A small Bronco seen head-on from across the deck, headlights on." },
      { file: "Ford pics jpeg (5 of 16).jpg", description: "Close on the grille and headlight, dew on the hood, an amber turn signal burning." },
      { file: "Ford pics jpeg (14 of 16).jpg", description: "A low angle on the front end: chrome bumper, square headlight and the glow of the signal." },
      { file: "Ford pics jpeg (11 of 16).jpg", description: "The front fender and headlight in portrait, two-tone paint catching the lamp light." },
      { file: "Ford pics jpeg (10 of 16).jpg", description: "The Bronco from behind, pale and green-tinted under the deck's lights." },
      { file: "Ford pics jpeg (4 of 16).jpg", description: "A distant Bronco centred in the frame, its amber lights the only warm colour." },
      { file: "Ford pics jpeg (16 of 16).jpg", description: "A dark truck waits at the far side of the deck beneath a street lamp.", caption: false },
    ],
  },
  {
    subdomain: "highsierra",
    folder: "mountain",
    name: "Anya Lindqvist",
    location: "Bishop, California",
    bio:
      "Anya Lindqvist is an example photographer, made up to show what a Folio site can look like.\n\n" +
      "High Country follows a week on the trail with friends: granite, lakes, cold mornings and long evenings at camp.",
    design: (d) => ({
      ...d,
      theme: "exhibition",
      colors: { background: "#f4f1ea", text: "#1d1d1b", muted: "#6f6c65", accent: "#2f5d50" },
      fonts: "serif",
      themeSettings: {
        ...d.themeSettings,
        exhibition: { ...d.themeSettings.exhibition, wall: "plaster", labels: "below", pro: { frame: "white", printSize: "large", labelFont: "serif" } },
      },
    }),
    shots: [
      { file: "0005)).jpg", description: "A hiker in a tan shirt looks out over a long valley and a distant range.", location: "Sierra Nevada, California", caption: true },
      { file: "0014)).jpg", description: "Sunlight on a still alpine lake below a bare granite slope.", location: "Sierra Nevada, California" },
      { file: "0013)).jpg", description: "Three backpackers cross a green meadow toward a dark peak.", location: "Sierra Nevada, California", caption: true },
      { file: "0010)).jpg", description: "Friends sit on camp stools beside a green tent, backlit by the low sun.", location: "Sierra Nevada, California" },
      { file: "0012)).jpg", description: "Two hikers perched on a granite boulder above a lake and a dark forest.", location: "Sierra Nevada, California" },
      { file: "0006)).jpg", description: "A tiny figure stands on pale boulders above a forested ridge.", location: "Sierra Nevada, California" },
      { file: "0017)).jpg", description: "A tin mug in focus on the grass, with the tent and mountain soft behind it.", location: "Sierra Nevada, California", caption: true },
      { file: "0009)).jpg", description: "A man in a teal jacket in profile against a violet dusk sky and a black ridge.", location: "Sierra Nevada, California" },
      { file: "0016)).jpg", description: "Stars over a dark ridgeline, with faint satellite trails crossing the sky.", location: "Sierra Nevada, California", caption: true },
      { file: "0023)).jpg", description: "Someone stands at the edge of a cliff above a lake basin, seen from behind.", location: "Sierra Nevada, California" },
      { file: "0001)).jpg", description: "A small lake and a long slope seen from high above, under a deep blue sky.", location: "Sierra Nevada, California" },
      { file: "0054)).jpg", description: "A wide meadow with one hiker standing and another sitting in the grass.", location: "Sierra Nevada, California" },
    ],
  },
  {
    subdomain: "streetlight",
    folder: "Street",
    name: "Mateo Ruiz",
    location: "Valencia, Spain",
    bio:
      "Mateo Ruiz is an example photographer, made up to show what a Folio site can look like.\n\n" +
      "Walking Light collects small scenes from streets in a few countries: people crossing a patch of sun, a colour on a wall, a moment before it's gone.",
    design: (d) => ({
      ...d,
      theme: "filmstrip",
      colors: { background: "#121110", text: "#ece7dc", muted: "#9a9387", accent: "#f0b44c" },
      fonts: "mono",
      themeSettings: {
        ...d.themeSettings,
        filmstrip: { stock: "gold", frameNumbers: true, pro: { frameSize: "large", border: "black", sprockets: true } },
      },
    }),
    shots: [
      { file: "20250627-IMG_1556.jpg", description: "Two girls walk past a yellow wall and a window full of flowers.", caption: true },
      { file: "20250627-IMG_1571.jpg", description: "A man walks through the shade past café awnings on a cobbled street." },
      { file: "IMG_6841.jpg", description: "Two pedestrians cross tram tracks painted red on a wide street.", caption: true },
      { file: "20250626-IMG_1245.jpg", description: "A man rests on a bench under pastel arches." },
      { file: "IMG_7133.jpg", description: "People in shadow and a patch of sun on a narrow alley.", caption: true },
      { file: "IMG_2055.jpg", description: "A person mid-flip on the beach beneath a lamp post and a warm sky." },
      { file: "IMG_1790.jpg", description: "A passer-by and a parked car, reflected in broken glass." },
      { file: "Woman Walking.jpg", description: "A woman walks past an orange building and a parked van." },
      { file: "Stop sign.jpg", description: "A no-entry sign above terracotta rooftops and tangled power lines.", location: "Spain" },
      { file: "USE-IMG_4683 (1).jpg", description: "A red pagoda against a bright blue sky.", location: "Asakusa, Tokyo", caption: true },
      { file: "IMG_0949.jpg", description: "A jagged peak above cloud and green slopes.", location: "Dolomites, Italy" },
    ],
  },
];

const root = path.resolve(process.env.EXAMPLES_PHOTOS_DIR ?? "folio-homepage-photos");
const year = new Date().getFullYear();
const copyrightLine = `© ${year} ${OPERATOR_NAME}. ${EXAMPLE_NOTE}.`;

const owner = process.env.EXAMPLES_OWNER_EMAIL ? await findUserByEmail(process.env.EXAMPLES_OWNER_EMAIL) : null;
if (process.env.EXAMPLES_OWNER_EMAIL && !owner) throw new Error(`No account with the email ${process.env.EXAMPLES_OWNER_EMAIL}`);

for (const example of EXAMPLES) {
  if (await findUserBySubdomain(example.subdomain)) {
    console.log(`${example.subdomain}: already exists, skipped`);
    continue;
  }
  // Check every file first, so a missing photo doesn't leave half a site.
  const sources = example.shots.map((s) => path.join(root, example.folder, s.file));
  await Promise.all(sources.map((f) => fs.access(f)));

  const user = await createUser({
    name: example.name,
    subdomain: example.subdomain,
    email: `${randomUUID()}@examples.folio.invalid`, // never used: nobody logs in to it
    passwordHash: "",
    published: true,
    emailVerified: true,
    termsAcceptedAt: true,
  });
  const rights = { artist: OPERATOR_NAME, copyright: copyrightLine };

  try {
    await fill(user.id, example, sources, rights);
  } catch (err) {
    // Don't leave half a site behind: remove its files and its row (straight
    // from the table, so the address isn't put on hold the way a closed account's is).
    await storage.removeAll(user.id).catch(() => {});
    await (await database()).query("delete from users where id = $1", [user.id]);
    throw err;
  }
}

async function fill(userId: string, example: Example, sources: string[], rights: { artist: string; copyright: string }) {
  const photos: Photo[] = [];
  for (const [i, shot] of example.shots.entries()) {
    // A 3000px original is plenty for an example, and keeps storage small.
    const original = await sharp(sources[i])
      .rotate()
      .resize({ width: 3000, height: 3000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    const id = randomUUID();
    const stored = await storePhoto(userId, `${id}.orig.jpg`, original, rights);
    photos.push({
      id,
      createdAt: new Date(Date.now() + i).toISOString(),
      ...stored,
      description: shot.description,
      alt: shot.description,
      ...(shot.location ? { location: shot.location } : {}),
    });
  }

  const design = designSchema.parse(
    (() => {
      const base = example.design(presetDesign());
      base.captions = {
        show: "chosen",
        photoIds: photos.filter((_, i) => example.shots[i].caption).map((p) => p.id),
        includeLocation: true,
      };
      for (const page of base.pages) {
        for (const section of page.sections) {
          if (section.type === "hero") {
            section.heading = example.name;
            section.subheading = EXAMPLE_NOTE;
          }
          if (section.type === "albums" || section.type === "contact") section.visible = false;
          if (section.type === "about") section.body = example.bio;
        }
      }
      return base;
    })(),
  );

  await updateUser(userId, (u) => {
    u.plan = "pro";
    u.photos = photos;
    u.design = design;
    u.draftDesign = design;
    u.profile.bio = example.bio;
    u.profile.location = example.location;
    u.profile.copyrightLine = copyrightLine;
    u.profile.contactEmail = "support@folio.cam";
    if (owner) u.managedBy = owner.id;
  });
  console.log(`${example.subdomain}: ${photos.length} photos, ${design.theme} theme`);
}

// Open database connections would otherwise keep the process alive.
process.exit(0);
