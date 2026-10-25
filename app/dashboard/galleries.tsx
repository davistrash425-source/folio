"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { createGallery, deleteGallery, setGalleryPhotos, updateGallery } from "@/app/actions/galleries";
import { Button, Field, Input, Message } from "@/app/ui/form";
import { ConfirmButton } from "@/app/ui/confirm";
import { PhotoPicker } from "./design/pickers";
import type { EditorPhoto } from "./design/types";

export function CreateGalleryForm() {
  const [state, action, pending] = useActionState(createGallery, {});
  return (
    <form action={action} className="max-w-md space-y-4">
      <Field label="Gallery name" hint="Usually the client or the shoot, like “Maya & Dan, June”.">
        <Input name="title" required maxLength={80} />
      </Field>
      <Field label="Password" hint="Give this to your client with the link. At least 6 characters.">
        <Input name="password" type="text" required minLength={6} autoComplete="off" />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create gallery"}</Button>
        <Message error={state.error} />
      </div>
    </form>
  );
}

export function GalleryDetailsForm({ gallery }: { gallery: { id: string; title: string } }) {
  const [state, action, pending] = useActionState(updateGallery.bind(null, gallery.id), {});
  return (
    <form action={action} className="max-w-md space-y-4">
      <Field label="Gallery name">
        <Input name="title" required maxLength={80} defaultValue={gallery.title} />
      </Field>
      <Field label="New password" hint="Leave empty to keep the current one. Changing it signs everyone out of the gallery.">
        <Input name="password" type="text" minLength={6} autoComplete="off" />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Message error={state.error} ok={state.ok} />
      </div>
    </form>
  );
}

export function GalleryPhotos({ galleryId, photos, selected }: { galleryId: string; photos: EditorPhoto[]; selected: string[] }) {
  const [ids, setIds] = useState(selected);
  const [message, setMessage] = useState<{ error?: string; ok?: string }>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <PhotoPicker photos={photos} selected={ids} onChange={setIds} ordered hint="Pick the photos your client will see, in the order you click them." />
      <div className="flex items-center gap-3">
        <Button type="button" disabled={pending} onClick={() => start(async () => setMessage(await setGalleryPhotos(galleryId, ids)))}>
          {pending ? "Saving…" : "Save photos"}
        </Button>
        <Message error={message.error} ok={message.ok} />
      </div>
    </div>
  );
}

export function DeleteGalleryButton({ galleryId, title }: { galleryId: string; title: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Delete gallery"
      message={`Delete “${title}”? The link stops working. Your photos stay in your library.`}
      confirmLabel="Delete"
      onConfirm={async () => {
        await deleteGallery(galleryId);
        router.push("/dashboard/manage/galleries");
      }}
      className="h-9 border border-rule px-4 text-sm hover:bg-ink/5"
      confirmClassName="h-9 bg-accent px-4 text-sm font-medium text-paper hover:bg-ink"
    />
  );
}
