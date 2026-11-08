import Link from "next/link";
import { listMessages, listThread, type Message, type MessageLabel, type User } from "@/lib/db";
import { filterThreadsByLabel, INBOX_LABELS, latestPerThread, parseInboxLabel, waitingLabel, type InboxThread } from "@/lib/messages";
import { primaryAddress } from "@/lib/mailboxes";
import { MarkRead, ThreadActions } from "./thread-actions";

const BASE = "/dashboard/manage/messages";

function who(m: Message) {
  if (m.direction === "out") return "You";
  return m.fromName.trim() || m.fromAddress;
}

function Chip({ label }: { label: MessageLabel }) {
  const urgent = label === "URGENT";
  return <span className={`label shrink-0 border px-1.5 ${urgent ? "border-accent text-accent" : "border-rule text-ink-soft"}`}>{label}</span>;
}

const preview = (m: Message) => m.body.replace(/\s+/g, " ").trim().slice(0, 140);

// The Inbox for accounts with the agents on. Everything a sender wrote is
// shown as plain text; none of it becomes a link or markup.
export async function AgentInbox({
  user,
  searchParams,
}: {
  user: User;
  searchParams: { label?: string | string[]; thread?: string | string[] };
}) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const label = parseInboxLabel(one(searchParams.label));
  const threadKey = one(searchParams.thread);
  const address = await primaryAddress(user);

  const header = address ? (
    <p className="break-all text-sm text-ink-soft">
      Your Folio address: <span className="font-medium text-ink">{address}</span>
    </p>
  ) : null;

  if (threadKey) {
    const thread = await listThread(user.id, threadKey);
    if (thread.length > 0) {
      return (
        <div className="space-y-4">
          {header}
          <ThreadView thread={thread} label={label} />
        </div>
      );
    }
  }

  const threads = latestPerThread(await listMessages(user.id, { limit: 200 }));
  const shown = filterThreadsByLabel(threads, label);
  return (
    <div className="space-y-4">
      {header}
      <nav aria-label="Filter messages" className="flex flex-wrap gap-2 text-sm">
        {[null, ...INBOX_LABELS].map((l) => (
          <Link
            key={l ?? "all"}
            href={l ? `${BASE}?label=${encodeURIComponent(l)}` : BASE}
            aria-current={l === label ? "page" : undefined}
            className={`border px-3 py-1.5 ${l === label ? "border-ink bg-ink text-paper" : "border-rule text-ink-soft hover:border-ink hover:text-ink"}`}
          >
            {l ?? "All"}
          </Link>
        ))}
      </nav>
      {threads.length === 0 ? (
        <p className="border border-rule bg-card p-6 text-sm text-ink-soft">
          No messages yet. When someone writes to you through your site or your Folio address, it shows up here.
        </p>
      ) : shown.length === 0 ? (
        <p className="border border-rule bg-card p-6 text-sm text-ink-soft">No {label?.toLowerCase()} messages.</p>
      ) : (
        <ul className="divide-y divide-rule border border-rule bg-card">
          {shown.map((t) => (
            <Row key={t.threadKey} t={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ t }: { t: InboxThread }) {
  const m = t.latestIncoming ?? t.latest;
  const waiting = waitingLabel(t.latest);
  const text = m.summary ?? preview(m);
  return (
    <li>
      <Link
        href={`${BASE}?thread=${encodeURIComponent(t.threadKey)}`}
        className={`flex gap-3 border-l-2 px-4 py-3 hover:bg-ink/5 ${m.label === "URGENT" ? "border-accent" : "border-transparent"}`}
      >
        <span aria-label={t.unread ? "Unread" : "Read"} className={`mt-2 h-2 w-2 shrink-0 rounded-full ${t.unread ? "bg-accent" : "bg-transparent"}`} />
        <span className="min-w-0 flex-1 space-y-1 text-sm">
          <span className="flex flex-wrap items-center gap-2">
            <span className={`truncate ${t.unread ? "font-semibold" : ""}`}>{who(m)}</span>
            {m.label && <Chip label={m.label} />}
            {m.senderCheck === "fail" && <span className="label text-accent">Unverified sender</span>}
            <span className="ml-auto shrink-0 text-xs text-ink-soft">
              {new Date(t.latest.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </span>
          <span className={`block truncate ${t.unread ? "font-semibold" : ""}`}>{m.subject || "(no subject)"}</span>
          <span className="block break-words text-ink-soft">{text}</span>
          {waiting && <span className="label block text-ink-faint">{waiting}</span>}
        </span>
      </Link>
    </li>
  );
}

function ThreadView({ thread, label }: { thread: Message[]; label: MessageLabel | null }) {
  const incoming = thread.filter((m) => m.direction === "in");
  const last = incoming[incoming.length - 1];
  const unreadIds = incoming.filter((m) => !m.read).map((m) => m.id);
  return (
    <div className="space-y-4">
      <MarkRead ids={unreadIds} />
      <Link href={label ? `${BASE}?label=${encodeURIComponent(label)}` : BASE} className="text-sm underline underline-offset-4 hover:text-accent">
        ← Back to the inbox
      </Link>
      <h2 className="break-words font-display text-2xl">{thread[0].subject || "(no subject)"}</h2>
      <ul className="space-y-4">
        {thread.map((m) => (
          <li key={m.id} className={`space-y-3 border bg-card p-4 text-sm ${m.label === "URGENT" ? "border-accent" : "border-rule"}`}>
            <p className="flex flex-wrap items-center gap-2 text-ink-soft">
              <span className="label text-ink-faint">{m.direction === "in" ? "Received" : "Sent"}</span>
              <span className="break-all font-medium text-ink">{who(m)}</span>
              {m.direction === "in" && m.fromName.trim() && <span className="break-all">{m.fromAddress}</span>}
              {m.label && <Chip label={m.label} />}
              <span className="ml-auto text-xs">{new Date(m.createdAt).toLocaleString()}</span>
            </p>
            {m.direction === "in" && m.senderCheck === "fail" && (
              <p className="border-l-2 border-accent pl-3 text-accent">This sender could not be verified</p>
            )}
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
            {(m.summary || m.suggestedAction) && (
              <div className="space-y-1 border-t border-rule pt-3 text-ink-soft">
                {m.summary && (
                  <p>
                    <span className="label mr-2 text-ink-faint">Assistant’s summary</span>
                    {m.summary}
                  </p>
                )}
                {m.suggestedAction && (
                  <p>
                    <span className="label mr-2 text-ink-faint">Assistant’s suggestion</span>
                    {m.suggestedAction}
                  </p>
                )}
              </div>
            )}
            {m.id === last?.id && <ThreadActions id={m.id} scam={m.label === "LIKELY SCAM"} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
