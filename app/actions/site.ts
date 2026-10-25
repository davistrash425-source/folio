"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { z } from "zod";
import { changeSubdomain, findUserBySubdomain, subdomainOnHold, updateUser, type Photo } from "@/lib/db";
import { impersonationBlock, requireUser } from "@/lib/auth";
import { photoLimit, photoLimitMessage } from "@/lib/plans";
import { draftDesign, publishedDesign } from "@/lib/public-site";
import { sendEmail } from "@/lib/email";
import { cleanSocial, cleanWebsite } from "@/lib/social";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { NOT_HUMAN, TURNSTILE_FIELD, verifyTurnstile } from "@/lib/turnstile";
import { ADDRESS_HOLD_MONTHS, appUrl, isLive, siteUrl, slugify, validateSlug, validateSubdomain } from "@/lib/site";
import {
  MAX_PHOTOS,
  deletePhotoFiles,
  photoRights,
  savePhoto,
  storage,
} from "@/lib/uploads";

export type ActionState = { error?: string; ok?: string };

// Every action re-checks the session itself rather than trusting the page. It
// also checks the account still exists: a login cookie outlives a deleted
// account (it's valid for 30 days), and must not be able to save anything.
async function currentUserId() {
  return (await requireUser()).id;
}

function done(message: string): ActionState {
  revalidatePath("/dashboard", "layout");
  return { ok: message };
}

export async function uploadPhotos(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const userId = user.id;
  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose at least one photo." };
  if (user.suspended) return { error: "Your site is suspended, so you can't upload photos right now." };
  if (user.photos.length >= photoLimit(user)) return { error: photoLimitMessage(user) };

  const saved: Awaited<ReturnType<typeof savePhoto>>[] = [];
  const skipped: string[] = [];
  const rights = photoRights(user.profile);
  for (const file of files) {
    try {
      saved.push(await savePhoto(userId, file, rights));
    } catch {
      skipped.push(file.name);
    }
  }
  let overLimit: typeof saved = [];
  if (saved.length) {
    try {
      await updateUser(userId, (u) => {
        const now = new Date().toISOString();
        // Checked again here, as another tab may have filled the space meanwhile.
        const room = Math.max(0, photoLimit(u) - u.photos.length);
        overLimit = saved.slice(room);
        u.photos.push(...saved.slice(0, room).map((photo) => ({ ...photo, createdAt: now })));
      });
    } catch (err) {
      // The account was deleted while the files were uploading (say, from
      // another tab). Don't leave its photos behind.
      if ((err as Error).message !== "USER_NOT_FOUND") throw err;
      await storage.removeAll(userId);
      redirect("/login");
    }
  }
  await Promise.all(overLimit.map((photo) => deletePhotoFiles(userId, { ...photo, createdAt: "" })));
  if (overLimit.length === saved.length && saved.length) return { error: photoLimitMessage(user) };
  if (skipped.length && !saved.length) {
    return { error: "Those files couldn't be uploaded. Use JPG, PNG, WebP, GIF or AVIF under 20 MB." };
  }
  const added = saved.length - overLimit.length;
  return done(
    `Uploaded ${added} photo${added === 1 ? "" : "s"}.` +
      (skipped.length ? ` Skipped: ${skipped.join(", ")}.` : "") +
      (overLimit.length ? ` ${overLimit.length} more didn't fit: ${photoLimitMessage(user)}` : ""),
  );
}

// Direct uploads to R2 go through app/api/photos/start and /finish instead,
// so several photos can upload at once (the browser runs actions one at a time).

export async function deletePhoto(photoId: string): Promise<ActionState> {
  const userId = await currentUserId();
  let removed: Photo | undefined;
  let held = false;
  await updateUser(userId, (u) => {
    if (u.legalHold) {
      held = true; // Folio must keep everything in this account for now
      return;
    }
    removed = u.photos.find((p) => p.id === photoId);
    u.photos = u.photos.filter((p) => p.id !== photoId);
    for (const album of u.albums ?? []) album.photoIds = album.photoIds.filter((id) => id !== photoId);
  });
  if (held) return { error: "Your account is on a legal hold, so this photo can't be deleted right now." };
  if (!removed) return { error: "That photo wasn't found." };
  await deletePhotoFiles(userId, removed);
  return done(`Deleted the photo.`);
}

// Server actions can be called with anything, not just what the page sends,
// so the arguments are checked before they're used. The text limits are
// generous: the fields cut text down to size afterwards, and these only stop
// absurd requests.
const reorderSchema = z.array(z.string().max(100)).max(MAX_PHOTOS * 2);
const photoDetailsSchema = z.object({
  description: z.string().max(5000),
  location: z.string().max(5000),
  alt: z.string().max(5000),
  albumIds: z.array(z.string().max(100)).max(1000),
});

// Saves a new photo order. The first photo is the cover image.
export async function reorderPhotos(rawIds: string[]) {
  const userId = await currentUserId();
  const photoIds = reorderSchema.safeParse(rawIds);
  if (!photoIds.success) return; // not something the page sends; change nothing
  await updateUser(userId, (u) => {
    const byId = new Map(u.photos.map((p) => [p.id, p]));
    const wanted = new Set(photoIds.data); // a photo listed twice still appears once
    const ordered = [...wanted].flatMap((id) => byId.get(id) ?? []);
    // Keep anything the client didn't know about (e.g. uploaded in another tab).
    const rest = u.photos.filter((p) => !wanted.has(p.id));
    u.photos = [...ordered, ...rest];
  });
  revalidatePath("/dashboard", "layout");
}

// Saves the details edited in the All photos drawer.
export async function updatePhoto(
  photoId: string,
  rawDetails: { description: string; location: string; alt: string; albumIds: string[] },
): Promise<ActionState> {
  const userId = await currentUserId();
  const parsed = photoDetailsSchema.safeParse(rawDetails);
  if (typeof photoId !== "string" || !parsed.success) return { error: "Those details couldn't be saved." };
  const details = parsed.data;
  await updateUser(userId, (u) => {
    const photo = u.photos.find((p) => p.id === photoId);
    if (!photo) return;
    photo.description = details.description.trim().slice(0, 500);
    photo.location = details.location.trim().slice(0, 120);
    photo.alt = details.alt.trim().slice(0, 300);
    for (const album of u.albums ?? []) {
      const inAlbum = album.photoIds.includes(photoId);
      const wanted = details.albumIds.includes(album.id);
      if (wanted && !inAlbum) album.photoIds.push(photoId);
      if (!wanted && inAlbum) album.photoIds = album.photoIds.filter((id) => id !== photoId);
    }
  });
  revalidatePath("/dashboard", "layout");
  return {};
}

// ── Several photos at once (the multi-select toolbar) ──────────────────

const photoIdsSchema = z.array(z.string().trim().min(1)).min(1).max(MAX_PHOTOS);
const photoPatchSchema = z
  .object({
    description: z.string().max(500).optional(),
    location: z.string().max(120).optional(),
    alt: z.string().max(300).optional(),
  })
  .strict();

// Sets captions, location or alt text on many photos at once. Fields that
// aren't given stay as they were.
export async function updatePhotos(rawIds: string[], details: { description?: string; location?: string; alt?: string }): Promise<ActionState> {
  const userId = await currentUserId();
  const ids = photoIdsSchema.safeParse(rawIds);
  if (!ids.success) return { error: "Choose at least one photo." };
  const patch = photoPatchSchema.safeParse(details);
  if (!patch.success) return { error: "That text is too long." };
  const wanted = new Set(ids.data);
  let changed = 0;
  await updateUser(userId, (u) => {
    for (const photo of u.photos) {
      if (!wanted.has(photo.id)) continue;
      if (patch.data.description !== undefined) photo.description = patch.data.description.trim();
      if (patch.data.location !== undefined) photo.location = patch.data.location.trim();
      if (patch.data.alt !== undefined) photo.alt = patch.data.alt.trim();
      changed++;
    }
  });
  if (changed === 0) return { error: "Those photos weren't found." };
  return done(`Updated ${changed} photo${changed === 1 ? "" : "s"}.`);
}

export async function addPhotosToAlbum(rawIds: string[], albumId: string): Promise<ActionState> {
  const userId = await currentUserId();
  const ids = photoIdsSchema.safeParse(rawIds);
  if (!ids.success) return { error: "Choose at least one photo." };
  const wanted = new Set(ids.data);
  let albumTitle: string | undefined;
  let missing = false;
  let added = 0;
  await updateUser(userId, (u) => {
    const album = u.albums?.find((a) => a.id === albumId);
    if (!album) {
      missing = true;
      return;
    }
    albumTitle = album.title;
    const mine = new Set(u.photos.map((p) => p.id));
    for (const id of wanted) {
      if (mine.has(id) && !album.photoIds.includes(id)) {
        album.photoIds.push(id);
        added++;
      }
    }
  });
  if (missing) return { error: "That album no longer exists." };
  return done(`Added ${added} photo${added === 1 ? "" : "s"} to “${albumTitle}”.`);
}

export async function deletePhotos(rawIds: string[]): Promise<ActionState> {
  const userId = await currentUserId();
  const ids = photoIdsSchema.safeParse(rawIds);
  if (!ids.success) return { error: "Choose at least one photo." };
  const wanted = new Set(ids.data);
  let removed: Photo[] = [];
  let held = false;
  await updateUser(userId, (u) => {
    if (u.legalHold) {
      held = true;
      return;
    }
    removed = u.photos.filter((p) => wanted.has(p.id));
    u.photos = u.photos.filter((p) => !wanted.has(p.id));
    for (const album of u.albums ?? []) album.photoIds = album.photoIds.filter((id) => !wanted.has(id));
  });
  if (held) return { error: "Your account is on a legal hold, so photos can't be deleted right now." };
  if (removed.length === 0) return { error: "Those photos weren't found." };
  await Promise.all(removed.map((photo) => deletePhotoFiles(userId, photo)));
  return done(`Deleted ${removed.length} photo${removed.length === 1 ? "" : "s"}.`);
}

export async function setPublished(published: boolean) {
  const userId = await currentUserId();
  await updateUser(userId, (u) => {
    u.published = published;
  });
  revalidatePath("/dashboard", "layout");
}

export async function saveProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await currentUserId();
  const str = (key: string, max: number) => String(formData.get(key) ?? "").trim().slice(0, max);
  const name = str("name", 80);
  if (!name) return { error: "Name can't be empty." };
  // Inquiry emails are sent to this address, so it has to be one (or empty,
  // which falls back to the login email).
  const contactEmail = str("contactEmail", 120);
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { error: "Please enter a valid contact email, or leave it empty." };
  }
  // Hidden from visitors unless switched on (see siteData).
  const showEmail = formData.get("showEmail") === "on";
  if (showEmail && !contactEmail) return { error: "Add the email to show on your site, or turn off “Show on my site”." };

  // Social fields take a handle or a link on the network's own domain.
  const field = (key: string) => String(formData.get(key) ?? "");
  const instagram = cleanSocial("instagram", field("instagram"));
  const twitter = cleanSocial("twitter", field("twitter"));
  const facebook = cleanSocial("facebook", field("facebook"));
  const website = cleanWebsite(field("website"));
  const badLink = [instagram, twitter, facebook, website].find((r) => r.error);
  if (badLink) return { error: badLink.error };

  await updateUser(userId, (u) => {
    u.profile = {
      name,
      bio: str("bio", 2000),
      contactEmail,
      showEmail,
      phone: str("phone", 40),
      location: str("location", 80),
      social: {
        instagram: instagram.value,
        twitter: twitter.value,
        facebook: facebook.value,
        website: website.value,
      },
      copyrightLine: str("copyrightLine", 120).replace(/\s+/g, " "),
    };
  });
  return done("Saved.");
}

// Whether the site asks AI companies' crawlers to stay away (app/robots.ts).
export async function saveAiTraining(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await currentUserId();
  await updateUser(userId, (u) => {
    u.allowAiTraining = !formData.get("blockAi");
  });
  return done("Saved.");
}

// ── Site address ────────────────────────────────────────────────────────

const ADDRESS_TAKEN = "That address is taken — try another.";

// Moves the site to name.<root domain>, if the name is free.
export async function changeAddress(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const blocked = await impersonationBlock();
  if (blocked) return { error: blocked };
  const subdomain = String(formData.get("subdomain") ?? "").trim().toLowerCase();
  if (subdomain === user.subdomain) return { error: "That’s already your address." };
  if (user.suspended) return { error: "A suspended site can’t change its address." };
  const invalid = validateSubdomain(subdomain);
  if (invalid) return { error: invalid };
  if (await subdomainOnHold(subdomain, ADDRESS_HOLD_MONTHS, user.id)) {
    return { error: "That address belonged to another site recently, so it’s held for a year. Try another." };
  }
  if (await findUserBySubdomain(subdomain)) return { error: ADDRESS_TAKEN };
  // Every move holds the old address for a year, so don't allow many.
  if (!(await rateLimit(`address:${user.id}`, 3, 24 * 60 * 60 * 1000))) {
    return { error: "You’ve changed your address several times today. Try again tomorrow." };
  }
  try {
    await changeSubdomain(user.id, subdomain);
  } catch (err) {
    if ((err as Error).message === "SUBDOMAIN_TAKEN") return { error: ADDRESS_TAKEN };
    throw err;
  }
  return done(`Your site is now at ${siteUrl(subdomain).replace(/^https?:\/\//, "")}.`);
}

// ── Albums ──────────────────────────────────────────────────────────────

export async function createAlbum(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireUser();
  const userId = owner.id;
  const title = String(formData.get("title") ?? "").trim().slice(0, 60);
  const description = String(formData.get("description") ?? "").trim().slice(0, 500);
  if (!title) return { error: "Give the album a name." };
  const slug = slugify(title);
  const slugError = validateSlug(slug);
  if (slugError) return { error: slugError };
  if ([draftDesign(owner), publishedDesign(owner)].some((d) => d.pages.some((p) => p.slug === slug))) {
    return { error: `One of your pages already uses the address /${slug}. Pick another album name.` };
  }

  // Photos to start with, from a selection in the photo grid.
  const wanted = new Set(formData.getAll("photoIds").map(String).slice(0, MAX_PHOTOS));

  const id = randomUUID();
  let taken = false;
  await updateUser(userId, (u) => {
    u.albums ??= [];
    if (u.albums.some((a) => a.slug === slug)) {
      taken = true;
      return;
    }
    // Only this account's own photos, in library order.
    const photoIds = u.photos.filter((p) => wanted.has(p.id)).map((p) => p.id);
    u.albums.push({ id, slug, title, description, photoIds });
  });
  if (taken) return { error: "You already have an album with that name." };
  revalidatePath("/dashboard", "layout");
  // Go straight to the new album so its photos can be picked. This happens
  // here, once, rather than in an effect on the form: the dashboard keeps
  // pages mounted while you navigate, so an effect would fire again every
  // time you came back to the Albums page.
  redirect(`/dashboard/manage/albums/${id}`);
}

export async function updateAlbum(
  albumId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await currentUserId();
  const title = String(formData.get("title") ?? "").trim().slice(0, 60);
  const description = String(formData.get("description") ?? "").trim().slice(0, 500);
  if (!title) return { error: "Give the album a name." };
  await updateUser(userId, (u) => {
    const album = u.albums?.find((a) => a.id === albumId);
    if (!album) return;
    album.title = title; // the address stays the same so links keep working
    album.description = description;
  });
  revalidatePath("/dashboard", "layout");
  return { ok: "Saved." };
}

// Sets the album's photos and their order (also used to remove photos).
export async function setAlbumPhotos(albumId: string, photoIds: string[]) {
  const userId = await currentUserId();
  await updateUser(userId, (u) => {
    const album = u.albums?.find((a) => a.id === albumId);
    if (!album) return;
    const existing = new Set(u.photos.map((p) => p.id));
    album.photoIds = [...new Set(photoIds)].filter((id) => existing.has(id));
    if (album.coverPhotoId && !album.photoIds.includes(album.coverPhotoId)) album.coverPhotoId = undefined;
  });
  revalidatePath("/dashboard", "layout");
}

export async function setAlbumCover(albumId: string, photoId: string) {
  const userId = await currentUserId();
  await updateUser(userId, (u) => {
    const album = u.albums?.find((a) => a.id === albumId);
    if (album?.photoIds.includes(photoId)) album.coverPhotoId = photoId;
  });
  revalidatePath("/dashboard", "layout");
}

export async function deleteAlbum(albumId: string) {
  const userId = await currentUserId();
  await updateUser(userId, (u) => {
    u.albums = (u.albums ?? []).filter((a) => a.id !== albumId);
  });
  revalidatePath("/dashboard", "layout");
}

// ── Inquiries ───────────────────────────────────────────────────────────

// Called from the contact form on a photographer's public site.
export async function sendInquiry(
  subdomain: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Bots fill in every field, including this one people never see.
  if (String(formData.get("company") ?? "")) return { ok: "Thanks — your message was sent." };

  const str = (key: string, max: number) => String(formData.get(key) ?? "").trim().slice(0, max);
  // One line: the name goes in the notification email's subject, where a line
  // break could add headers (like a hidden Bcc).
  const name = str("name", 80).replace(/\s+/g, " ");
  const email = str("email", 120);
  const date = str("date", 80);
  const message = str("message", 4000);
  if (!name || !message) return { error: "Please add your name and a message." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email so they can reply." };

  const ip = await clientIp();
  if (!(await rateLimit(`inquiry:${ip}`, 5, 60 * 60 * 1000))) {
    return { error: "You've sent several messages already. Please try again later." };
  }
  if (!(await verifyTurnstile(formData.get(TURNSTILE_FIELD), ip))) return { error: NOT_HUMAN };

  const owner = await findUserBySubdomain(subdomain);
  if (!owner || !isLive(owner)) return { error: "This site isn't accepting messages." };
  // From a photo's "Inquire" button. Kept only if it's one of this site's
  // photos visitors can see; anything else is dropped, not an error.
  const photoId = str("photoId", 64);
  const photo = photoId ? owner.photos.find((p) => p.id === photoId && !p.removed) : undefined;

  await updateUser(owner.id, (u) => {
    u.inquiries ??= [];
    u.inquiries.unshift({
      id: randomUUID(),
      name,
      email,
      date,
      message,
      createdAt: new Date().toISOString(),
      read: false,
      ...(photo ? { photoId: photo.id } : {}),
    });
    u.inquiries = u.inquiries.slice(0, 500);
  }, { publicChange: false });

  try {
    await sendEmail({
      to: owner.profile.contactEmail || owner.email,
      replyTo: email,
      subject: `New inquiry from ${name}`,
      text: `${name} (${email}) sent you a message through your Folio site.\n\n${photo ? `About the photo: ${photo.description || "untitled"}\n\n` : ""}${date ? `Date: ${date}\n\n` : ""}${message}\n\nSee all inquiries: ${appUrl("/dashboard/manage/messages")}`,
    });
  } catch (err) {
    // The inquiry is saved in the dashboard even if the email fails.
    console.error("Inquiry email failed", err);
  }
  return { ok: "Thanks — your message was sent." };
}

export async function setInquiryRead(inquiryId: string, read: boolean) {
  const userId = await currentUserId();
  await updateUser(userId, (u) => {
    const inquiry = u.inquiries?.find((i) => i.id === inquiryId);
    if (inquiry) inquiry.read = read;
  }, { publicChange: false });
  revalidatePath("/dashboard", "layout");
}

export async function deleteInquiry(inquiryId: string) {
  const userId = await currentUserId();
  await updateUser(userId, (u) => {
    u.inquiries = (u.inquiries ?? []).filter((i) => i.id !== inquiryId);
  }, { publicChange: false });
  revalidatePath("/dashboard", "layout");
}
