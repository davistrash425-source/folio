"use client";

import { useActionState, useState, useTransition } from "react";
import { addBooking, cancelBookingAction, confirmBookingAction, moveBookingAction, setTimeZone } from "@/app/actions/bookings";
import { Button, Field, Input, Message, SecondaryButton, inputClass, quietButtonClass } from "@/app/ui/form";
import { keepFields } from "@/app/ui/keep-fields";

export function TimeZoneForm({ current }: { current: string | null }) {
  const [state, action, pending] = useActionState(keepFields(setTimeZone), {});
  const [browserZone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "";
    }
  });
  return (
    <form action={action} noValidate className="space-y-3 text-sm">
      <p>
        {current ? <>Your time zone is <strong>{current}</strong>.</> : <>No time zone is set, so times show in <strong>UTC</strong>.</>}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Time zone" hint="A name like Europe/Amsterdam or America/New_York.">
          <Input name="timeZone" defaultValue={state.fields?.timeZone ?? (current || browserZone)} maxLength={100} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : !current && browserZone ? "Use this browser’s zone" : "Save"}
        </Button>
      </div>
      <Message error={state.error} ok={state.ok} />
    </form>
  );
}

export function AddBookingForm() {
  const [state, action, pending] = useActionState(keepFields(addBooking), {});
  const f = state.fields;
  const [allDay, setAllDay] = useState(false);
  return (
    <form action={action} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="What is it?">
        <select name="kind" defaultValue={f?.kind ?? "booking"} className={inputClass}>
          <option value="booking">Booking</option>
          <option value="hold">Hold</option>
        </select>
      </Field>
      <Field label="Title"><Input name="title" maxLength={120} defaultValue={f?.title} /></Field>
      <Field label="Client’s name"><Input name="clientName" maxLength={120} defaultValue={f?.clientName} /></Field>
      <Field label="Client’s email (optional)"><Input name="clientEmail" type="email" maxLength={200} defaultValue={f?.clientEmail} /></Field>
      <Field label="Date"><Input name="date" type="date" defaultValue={f?.date} /></Field>
      <label className="flex items-center gap-2 text-sm sm:self-end sm:pb-2">
        <input type="checkbox" name="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day
      </label>
      {!allDay && (
        <>
          <Field label="Starts"><Input name="startTime" type="time" defaultValue={f?.startTime} /></Field>
          <Field label="Ends"><Input name="endTime" type="time" defaultValue={f?.endTime} /></Field>
        </>
      )}
      <div className="sm:col-span-2">
        <Field label="Notes">
          <textarea name="notes" rows={3} maxLength={2000} defaultValue={f?.notes} className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add"}</Button>
        <Message error={state.error} ok={state.ok} />
      </div>
    </form>
  );
}

// Confirm / Move / Cancel for one booking. Plain text only.
export function BookingActions({
  id,
  mode,
  date,
  startTime,
  endTime,
  allDay,
}: {
  id: string;
  mode: "request" | "booked";
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
}) {
  const [pending, start] = useTransition();
  const [moving, setMoving] = useState(false);
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});
  const [all, setAll] = useState(allDay);
  const run = (fn: () => Promise<{ ok?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (!r.error) setMoving(false);
    });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {mode === "request" && <Button disabled={pending} onClick={() => run(() => confirmBookingAction(id))}>Confirm</Button>}
        {mode === "booked" && (
          <SecondaryButton disabled={pending} onClick={() => setMoving(!moving)}>{moving ? "Close" : "Move"}</SecondaryButton>
        )}
        <button type="button" disabled={pending} onClick={() => run(() => cancelBookingAction(id))} className={quietButtonClass}>Cancel</button>
        <Message error={result.error} ok={result.ok} />
      </div>
      {moving && (
        <form action={(formData) => run(() => moveBookingAction(id, formData))} className="grid gap-3 sm:grid-cols-4">
          <Field label="Date"><Input name="date" type="date" defaultValue={date} /></Field>
          <label className="flex items-center gap-2 text-sm sm:self-end sm:pb-2">
            <input type="checkbox" name="allDay" checked={all} onChange={(e) => setAll(e.target.checked)} /> All day
          </label>
          {!all && (
            <>
              <Field label="Starts"><Input name="startTime" type="time" defaultValue={startTime} /></Field>
              <Field label="Ends"><Input name="endTime" type="time" defaultValue={endTime} /></Field>
            </>
          )}
          <div className="sm:col-span-4"><Button type="submit" disabled={pending}>Move</Button></div>
        </form>
      )}
    </div>
  );
}
