"use client";

import { useActionState } from "react";
import { saveBusiness } from "@/app/actions/business";
import { Button, Field, Message, inputClass } from "@/app/ui/form";
import { keepFields } from "@/app/ui/keep-fields";
import type { User } from "@/lib/db";

// The facts the agents may use in replies. Lives on the Your business page.
export function BusinessForm({ business }: { business: User["business"] }) {
  const [state, action, pending] = useActionState(keepFields(saveBusiness), {});
  // After a failed save, what was typed; otherwise what's saved.
  const f = state.fields;
  const value = (name: "rates" | "tone" | "rules") => f?.[name] ?? business?.[name];

  return (
    <form action={action} noValidate className="grid gap-4">
      <Field label="Rates" hint="Prices, packages and what they include, so agents can quote them accurately.">
        <textarea
          name="rates"
          maxLength={4000}
          rows={5}
          defaultValue={value("rates")}
          placeholder="Portrait session, 1 hour: €250. Wedding coverage, 8 hours: from €2,400."
          className={inputClass}
        />
      </Field>
      <Field label="Tone" hint="How replies should sound, like friendly and brief, or formal.">
        <textarea
          name="tone"
          maxLength={4000}
          rows={4}
          defaultValue={value("tone")}
          placeholder="Warm and direct. Sign off with my first name."
          className={inputClass}
        />
      </Field>
      <Field label="Rules" hint="Things agents must always or never do, like dates they must not promise.">
        <textarea
          name="rules"
          maxLength={4000}
          rows={5}
          defaultValue={value("rules")}
          placeholder="Never confirm a booking without asking me first. I don't shoot on Sundays."
          className={inputClass}
        />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Message error={state.error} ok={state.ok} />
      </div>
    </form>
  );
}
