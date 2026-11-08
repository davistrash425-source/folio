"use client";

import { useRef, useState } from "react";
import { stopTask } from "@/app/actions/agents";
import { Button, SecondaryButton, inputClass } from "@/app/ui/form";

type Message = { id: string; role: "user" | "assistant"; text: string };

const STEP_LABELS: Record<string, string> = {
  list_recent_tasks: "Looking at recent tasks",
  get_task_result: "Reading a task's result",
  get_business: "Reading your business details",
  propose_note: "Preparing a note for your approval",
  assign_task: "Passing work to another agent",
};

type ChatEvent = { type?: string; name?: string; text?: string; message?: string; taskId?: string };

// The chat with the manager agent. Everything is rendered as plain text.
export function AgentChat({ initial }: { initial: Message[] }) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState("");
  const taskId = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  function handle(line: string) {
    if (!line.trim()) return;
    let event: ChatEvent;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    if (event.type === "start" && event.taskId) taskId.current = event.taskId;
    else if (event.type === "tool" && event.name) {
      const label = STEP_LABELS[event.name] ?? "Working";
      setSteps((s) => [...s, label]);
    } else if (event.type === "reply" && typeof event.text === "string") {
      const reply = event.text;
      setMessages((m) => [...m, { id: `reply-${event.taskId}`, role: "assistant", text: reply }]);
    } else if (event.type === "error") setError(event.message ?? "Something went wrong.");
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || running) return;
    setText("");
    setError("");
    setSteps([]);
    setRunning(true);
    taskId.current = null;
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", text: message }]);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        setError(typeof body?.error === "string" ? body.error : "Something went wrong. Please try again.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handle);
      }
      handle(buffer);
    } catch {
      if (!controller.signal.aborted) setError("The connection was lost. Please try again.");
    } finally {
      setRunning(false);
      abort.current = null;
    }
  }

  async function stop() {
    const id = taskId.current;
    // Not started yet: without the task's id the run couldn't actually be stopped.
    if (!id) return;
    abort.current?.abort();
    setError("Stopped.");
    if (id) await stopTask(id);
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3" aria-live="polite">
        {messages.length === 0 && <li className="text-sm text-ink-faint">No messages yet. Say hello.</li>}
        {messages.map((m) => (
          <li
            key={m.id}
            className={`max-w-2xl whitespace-pre-wrap border px-4 py-3 text-sm ${m.role === "user" ? "ml-auto border-rule bg-card" : "border-ink"}`}
          >
            <span className="label mb-1 block text-ink-faint">{m.role === "user" ? "You" : "Assistant"}</span>
            {m.text}
          </li>
        ))}
      </ul>
      {running && (
        <p className="text-sm text-ink-soft" role="status">
          {steps.length ? `${steps[steps.length - 1]}…` : "Thinking…"}
        </p>
      )}
      {error && (
        <p className="text-sm text-accent" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={send} className="grid gap-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
          rows={3}
          disabled={running}
          aria-label="Your message"
          placeholder="Ask something…"
          className={inputClass}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={running || !text.trim()}>
            {running ? "Working…" : "Send"}
          </Button>
          {running && <SecondaryButton onClick={stop}>Stop</SecondaryButton>}
        </div>
      </form>
    </div>
  );
}
