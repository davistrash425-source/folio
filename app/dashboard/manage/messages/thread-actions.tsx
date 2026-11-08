"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMessageAction, draftReplyAction, markNotScamAction, setMessageReadAction } from "@/app/actions/messages";
import { ConfirmButton } from "@/app/ui/confirm";
import { Message, buttonClass, dangerButtonClass, quietButtonClass } from "@/app/ui/form";

// Opening a thread marks its incoming messages read, once.
export function MarkRead({ ids }: { ids: string[] }) {
  const router = useRouter();
  const key = ids.join(",");
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    (async () => {
      for (const id of key.split(",")) await setMessageReadAction(id, true);
      if (!cancelled) router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [key, router]);
  return null;
}

// Plain text throughout. Nothing here turns a sender's words into a link.
export function ThreadActions({ id, scam }: { id: string; scam: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});
  const [drafted, setDrafted] = useState(false);

  const draft = () =>
    start(async () => {
      const r = await draftReplyAction(id);
      if (r.error) setResult({ error: r.error });
      else {
        setResult({});
        setDrafted(true);
      }
    });

  const leave = (action: () => Promise<{ ok?: string; error?: string }>) =>
    start(async () => {
      const r = await action();
      setResult(r);
      if (!r.error) router.push("/dashboard/manage/messages");
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {scam ? (
          <>
            <p className="text-sm text-ink-soft">Likely scam. Folio won’t draft a reply.</p>
            <button type="button" className={quietButtonClass} disabled={pending} onClick={() => start(async () => { setResult(await markNotScamAction(id)); router.refresh(); })}>
              Not a scam
            </button>
          </>
        ) : (
          <button type="button" className={buttonClass} disabled={pending} onClick={draft}>
            {pending ? "Drafting… this can take up to 20 seconds" : "Draft a reply"}
          </button>
        )}
        <button type="button" className={quietButtonClass} disabled={pending} onClick={() => leave(() => setMessageReadAction(id, false))}>
          Mark unread
        </button>
        <ConfirmButton
          label="Delete"
          message="Delete this message?"
          confirmLabel="Delete"
          className={dangerButtonClass}
          disabled={pending}
          onConfirm={() => leave(() => deleteMessageAction(id))}
        />
      </div>
      {drafted && (
        <p className="text-sm" aria-live="polite">
          A reply is ready for you to check.{" "}
          <Link href="/dashboard/manage/approvals" className="underline underline-offset-4 hover:text-accent">
            Go to Approvals
          </Link>
        </p>
      )}
      <Message error={result.error} ok={result.ok} />
    </div>
  );
}
