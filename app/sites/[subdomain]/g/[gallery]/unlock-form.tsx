"use client";

import { useActionState } from "react";
import { unlockGallery } from "@/app/actions/galleries";
import { Button, Field, Input, Message } from "@/app/ui/form";

export function UnlockForm({ subdomain, slug }: { subdomain: string; slug: string }) {
  const [state, action, pending] = useActionState(unlockGallery.bind(null, subdomain, slug), {});
  return (
    <form action={action} className="space-y-4">
      <Field label="Password">
        <Input name="password" type="password" required autoComplete="off" data-autofocus />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Opening…" : "Open gallery"}</Button>
        <Message error={state.error} />
      </div>
    </form>
  );
}
