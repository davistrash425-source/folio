"use client";

import { useState, useTransition } from "react";
import { approve, reject, reviseNote } from "@/app/actions/agents";
import { Button, Message, SecondaryButton, inputClass } from "@/app/ui/form";

// One request waiting for a click. Plain text only.
export function ApprovalCard({
  id,
  kind,
  summary,
  detail,
  editableText,
  createdAt,
}: {
  id: string;
  kind: string;
  summary: string;
  detail: string;
  editableText: string; // the words the Edit box starts with (a note's text, or an email's body)
  createdAt: string;
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(editableText);
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});

  const run = (action: () => Promise<{ ok?: string; error?: string }>) =>
    start(async () => {
      const r = await action();
      setResult(r);
      if (!r.error) setEditing(false);
    });

  return (
    <div className="space-y-3 border border-ink px-4 py-4 text-sm">
      <p className="text-ink-soft">
        <span className="label mr-2 text-ink-faint">Assistant’s summary</span>
        {summary}
      </p>
      <p className="label text-ink-faint">{new Date(createdAt).toLocaleString()}</p>
      {editing ? (
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={20000} rows={kind === "send_email_reply" ? 12 : 5} className={inputClass} aria-label={kind === "send_email_reply" ? "Edit the email" : "Edit the note"} />
      ) : (
        <p className="whitespace-pre-wrap font-medium">If you approve: {detail}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {editing ? (
          <>
            <Button disabled={pending || !draft.trim()} onClick={() => run(() => reviseNote(id, draft))}>
              Save edit
            </Button>
            <SecondaryButton disabled={pending} onClick={() => setEditing(false)}>
              Cancel
            </SecondaryButton>
          </>
        ) : (
          <>
            <Button disabled={pending} onClick={() => run(() => approve(id))}>
              Approve
            </Button>
            <SecondaryButton disabled={pending} onClick={() => run(() => reject(id))}>
              Reject
            </SecondaryButton>
            {(kind === "save_note" || kind === "send_email_reply") && (
              <SecondaryButton disabled={pending} onClick={() => setEditing(true)}>
                Edit
              </SecondaryButton>
            )}
          </>
        )}
        <Message error={result.error} ok={result.ok} />
      </div>
    </div>
  );
}
