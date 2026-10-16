"use client";

/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import { useActionState, useState, useTransition } from "react";
import { deleteAccount, resendVerification, type FormState } from "@/app/actions/auth";
import {
  createAlbum,
  deleteAlbum,
  deleteInquiry,
  renameAlbum,
  setInquiryRead,
  setPublished,
  toggleAlbumPhoto,
} from "@/app/actions/site";
import { Button, Field, Input, Message } from "@/app/ui/form";
import type { Inquiry } from "@/lib/db";

export function PublishToggle({ published }: { published: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setPublished(!published))}
      className={`rounded-full px-4 py-2 text-sm font-medium ring-1 disabled:opacity-50 ${
        published ? "ring-zinc-300 hover:bg-zinc-100" : "bg-green-700 text-white ring-green-700 hover:bg-green-800"
      }`}
    >
      {pending ? "Saving…" : published ? "Unpublish" : "Publish site"}
    </button>
  );
}

export function VerifyEmailBanner({ email }: { email: string }) {
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-6 py-4 text-sm text-amber-900 ring-1 ring-amber-200">
      <span className="flex-1">Confirm your email address ({email}) so you can reset your password if you ever forget it.</span>
      {state.ok || state.error ? (
        <Message ok={state.ok} error={state.error} />
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => setState(await resendVerification()))}
          className="rounded-full bg-amber-900 px-4 py-1.5 font-medium text-white disabled:opacity-50"
        >
          {pending ? "Sending…" : "Resend email"}
        </button>
      )}
    </div>
  );
}

type AlbumView = { id: string; slug: string; title: string; photoIds: string[]; url: string };

export function AlbumManager({ albums, photos }: { albums: AlbumView[]; photos: { id: string; src: string }[] }) {
  const [state, action, creating] = useActionState(createAlbum, {});
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Field label="New album">
            <Input name="title" required maxLength={60} placeholder="Weddings" key={state.ok} />
          </Field>
        </div>
        <Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create album"}</Button>
        <Message error={state.error} ok={state.ok} />
      </form>

      {albums.length === 0 ? (
        <p className="text-sm text-zinc-500">No albums yet. Albums with photos show up as pages on your site, like /weddings.</p>
      ) : (
        <ul className={`divide-y divide-zinc-200 rounded-xl ring-1 ring-zinc-200 ${pending ? "opacity-70" : ""}`}>
          {albums.map((album) => (
            <li key={album.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <p className="font-medium">{album.title}</p>
                  <p className="text-sm text-zinc-500">
                    {album.photoIds.length} photo{album.photoIds.length === 1 ? "" : "s"} ·{" "}
                    {album.photoIds.length > 0 ? (
                      <a href={album.url} target="_blank" rel="noopener noreferrer" className="underline">/{album.slug}</a>
                    ) : (
                      "add photos to show it on your site"
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(openId === album.id ? null : album.id)}
                  aria-expanded={openId === album.id}
                  className="rounded-full px-3 py-1.5 text-sm ring-1 ring-zinc-300 hover:bg-zinc-100"
                >
                  {openId === album.id ? "Done" : "Choose photos"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const title = prompt("Rename album", album.title);
                    if (title) startTransition(() => renameAlbum(album.id, title));
                  }}
                  className="rounded-full px-3 py-1.5 text-sm hover:bg-zinc-100"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete the album “${album.title}”? The photos stay in your library.`)) {
                      startTransition(() => deleteAlbum(album.id));
                    }
                  }}
                  className="rounded-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
              {openId === album.id && (
                photos.length === 0 ? (
                  <p className="mt-3 text-sm text-zinc-500">Upload photos first.</p>
                ) : (
                  <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
                    {photos.map((photo) => {
                      const selected = album.photoIds.includes(photo.id);
                      return (
                        <li key={photo.id}>
                          <button
                            type="button"
                            aria-pressed={selected}
                            aria-label={selected ? "Remove from album" : "Add to album"}
                            onClick={() => startTransition(() => toggleAlbumPhoto(album.id, photo.id))}
                            className={`relative block w-full overflow-hidden rounded-md ring-offset-2 ${selected ? "ring-2 ring-black" : "opacity-50 hover:opacity-100"}`}
                          >
                            <img src={photo.src} alt="" className="aspect-square w-full object-cover" />
                            {selected && (
                              <span className="absolute right-1 top-1 rounded-full bg-black px-1.5 text-xs text-white">✓</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Inbox({ inquiries }: { inquiries: Inquiry[] }) {
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);

  if (inquiries.length === 0) {
    return <p className="text-sm text-zinc-500">No messages yet. Visitors can contact you with the form at the bottom of your site.</p>;
  }

  return (
    <ul className={`divide-y divide-zinc-200 rounded-xl ring-1 ring-zinc-200 ${pending ? "opacity-70" : ""}`}>
      {inquiries.map((q) => {
        const open = openId === q.id;
        return (
          <li key={q.id} className="p-4">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => {
                setOpenId(open ? null : q.id);
                if (!q.read) startTransition(() => setInquiryRead(q.id, true));
              }}
              className="flex w-full items-baseline gap-3 text-left"
            >
              {!q.read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}
              <span className={`flex-1 truncate ${q.read ? "" : "font-semibold"}`}>
                {q.name} <span className="font-normal text-zinc-500">— {q.message.slice(0, 80)}</span>
              </span>
              <time className="shrink-0 text-xs text-zinc-500" dateTime={q.createdAt}>
                {new Date(q.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </time>
            </button>
            {open && (
              <div className="mt-3 space-y-3 pl-5 text-sm">
                <p className="text-zinc-600">
                  <a href={`mailto:${q.email}`} className="underline">{q.email}</a>
                  {q.date && <> · Date: {q.date}</>}
                </p>
                <p className="whitespace-pre-line">{q.message}</p>
                <div className="flex gap-2">
                  <a
                    href={`mailto:${q.email}?subject=${encodeURIComponent("Re: your inquiry")}`}
                    className="rounded-full bg-black px-4 py-1.5 font-medium text-white"
                  >
                    Reply
                  </a>
                  <button
                    type="button"
                    onClick={() => startTransition(() => setInquiryRead(q.id, false))}
                    className="rounded-full px-3 py-1.5 hover:bg-zinc-100"
                  >
                    Mark unread
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this message?")) startTransition(() => deleteInquiry(q.id));
                    }}
                    className="rounded-full px-3 py-1.5 text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function AccountSettings() {
  const [state, action, pending] = useActionState(deleteAccount, {});
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium">Download your data</h3>
        <p className="mb-3 text-sm text-zinc-500">A .zip with your original photos and everything you’ve entered.</p>
        <a href="/api/export" className="inline-flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 ring-zinc-300 hover:bg-zinc-100">
          Download .zip
        </a>
      </div>
      <div>
        <h3 className="font-medium text-red-700">Delete account</h3>
        <p className="mb-3 text-sm text-zinc-500">Permanently deletes your site, photos and messages. This can’t be undone.</p>
        {confirming ? (
          <form action={action} className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <Field label="Enter your password to confirm">
                <Input name="password" type="password" required autoComplete="current-password" />
              </Field>
            </div>
            <Button type="submit" disabled={pending} className="bg-red-600 hover:bg-red-700">
              {pending ? "Deleting…" : "Delete everything"}
            </Button>
            <button type="button" onClick={() => setConfirming(false)} className="h-10 rounded-full px-4 text-sm hover:bg-zinc-100">
              Cancel
            </button>
            <div className="w-full"><Message error={state.error} /></div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="h-10 rounded-full px-5 text-sm font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-50"
          >
            Delete my account…
          </button>
        )}
      </div>
    </div>
  );
}
