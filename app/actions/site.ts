"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { findUserById, findUserBySubdomain, updateUser, type Photo } from "@/lib/db";
import { draftDesign, publishedDesign } from "@/lib/public-site";
import { sendEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSessionUserId } from "@/lib/session";
import { appUrl, isPublished, slugify, validateSlug } from "@/lib/site";
import { deletePhotoFiles, savePhoto } from "@/lib/uploads";

export type ActionState = { error?: string; ok?: string };

// Every action re-checks the session itself rather than trusting the page.
async function currentUserId() {
  const id = await getSessionUserId();
  if (!id) redirect("/login");
  return id;
}

function done(message: string): ActionState {
  revalidatePath("/dashboard", "layout");
  return { ok: message };
}

export async function uploadPhotos(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await currentUserId();
  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose at least one photo." };

  const saved: Awaited<ReturnType<typeof savePhoto>>[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    try {
      saved.push(await savePhoto(userId, file));
    } catch {
      skipped.push(file.name);
    }
  }
  if (saved.length) {
    await updateUser(userId, (u) => {
      const now = new Date().toISOString();
      u.photos.push(...saved.map((photo) => ({ ...photo, createdAt: now })));
    });
  }
  if (skipped.length && !saved.length) {
    return { error: "Those files couldn't be uploaded. Use JPG, PNG, WebP, GIF or AVIF under 20 MB." };
  }
  return done(
    `Uploaded ${saved.length} photo${saved.length === 1 ? "" : "s"}.` +
      (skipped.length ? ` Skipped: ${skipped.join(", ")}.` : ""),
  );
}

export async function deletePhoto(photoId: string) {
  const userId = await currentUserId();
  let removed: Photo | undefined;
  await updateUser(userId, (u) => {
    removed = u.photos.find((p) => p.id === photoId);
    u.photos = u.photos.filter((p) => p.id !== photoId);
    for (const album of u.albums ?? []) album.photoIds = album.photoIds.filter((id) => id !== photoId);
  });
  if (removed) await deletePhotoFiles(userId, removed);
  revalidatePath("/dashboard", "layout");
}

// Saves a new photo order. The first photo is the cover image.
export async function reorderPhotos(photoIds: string[]) {
  const userId = await currentUserId();
  await updateUser(userId, (u) => {
    const byId = new Map(u.photos.map((p) => [p.id, p]));
    const ordered = photoIds.flatMap((id) => byId.get(id) ?? []);
    // Keep anything the client didn't know about (e.g. uploaded in another tab).
    const rest = u.photos.filter((p) => !photoIds.includes(p.id));
    u.photos = [...ordered, ...rest];
  });
  revalidatePath("/dashboard", "layout");
}

// Saves the details edited in the All photos drawer.
export async function updatePhoto(
  photoId: string,
  details: { description: string; location: string; alt: string; albumIds: string[] },
) {
  const userId = await currentUserId();
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
}

export async function setPublished(published: boolean) {
  const userId = await currentUserId();
  await updateUser(userId, (u) => {
    u.published = published;
  });
  revalidatePath("/dashboard", "layout");
}

function cleanUrl(value: FormDataEntryValue | null) {
  const v = String(value ?? "").trim();
  if (!v) return undefined;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export async function saveProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await currentUserId();
  const str = (key: string, max: number) => String(formData.get(key) ?? "").trim().slice(0, max);
  const name = str("name", 80);
  if (!name) return { error: "Name can't be empty." };

  await updateUser(userId, (u) => {
    u.profile = {
      name,
      bio: str("bio", 2000),
      contactEmail: str("contactEmail", 120),
      phone: str("phone", 40),
      location: str("location", 80),
      social: {
        instagram: cleanUrl(formData.get("instagram")),
        twitter: cleanUrl(formData.get("twitter")),
        facebook: cleanUrl(formData.get("facebook")),
        website: cleanUrl(formData.get("website")),
      },
    };
  });
  return done("Saved.");
}

// ── Albums ──────────────────────────────────────────────────────────────

export async function createAlbum(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await currentUserId();
  const title = String(formData.get("title") ?? "").trim().slice(0, 60);
  const description = String(formData.get("description") ?? "").trim().slice(0, 500);
  if (!title) return { error: "Give the album a name." };
  const slug = slugify(title);
  const slugError = validateSlug(slug);
  if (slugError) return { error: slugError };
  const owner = await findUserById(userId);
  if (owner && [draftDesign(owner), publishedDesign(owner)].some((d) => d.pages.some((p) => p.slug === slug))) {
    return { error: `One of your pages already uses the address /${slug}. Pick another album name.` };
  }

  const id = randomUUID();
  let taken = false;
  await updateUser(userId, (u) => {
    u.albums ??= [];
    if (u.albums.some((a) => a.slug === slug)) {
      taken = true;
      return;
    }
    u.albums.push({ id, slug, title, description, photoIds: [] });
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
  const name = str("name", 80);
  const email = str("email", 120);
  const date = str("date", 80);
  const message = str("message", 4000);
  if (!name || !message) return { error: "Please add your name and a message." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email so they can reply." };

  if (!rateLimit(`inquiry:${await clientIp()}`, 5, 60 * 60 * 1000)) {
    return { error: "You've sent several messages already. Please try again later." };
  }

  const owner = await findUserBySubdomain(subdomain);
  if (!owner || !isPublished(owner)) return { error: "This site isn't accepting messages." };

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
    });
    u.inquiries = u.inquiries.slice(0, 500);
  });

  try {
    await sendEmail({
      to: owner.profile.contactEmail || owner.email,
      replyTo: email,
      subject: `New inquiry from ${name}`,
      text: `${name} (${email}) sent you a message through your Folio site.\n\n${date ? `Date: ${date}\n\n` : ""}${message}\n\nSee all inquiries: ${appUrl("/dashboard/manage/messages")}`,
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
  });
  revalidatePath("/dashboard", "layout");
}

export async function deleteInquiry(inquiryId: string) {
  const userId = await currentUserId();
  await updateUser(userId, (u) => {
    u.inquiries = (u.inquiries ?? []).filter((i) => i.id !== inquiryId);
  });
  revalidatePath("/dashboard", "layout");
}
