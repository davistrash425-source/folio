"use client";

import Link from "next/link";
import { useState } from "react";
import { DevicePreview, DeviceButtons, type Device } from "../device-preview";

export function PreviewWorkspace({ pages, liveUrl, hasUnpublishedDesign }: {
  pages: { path: string; title: string }[];
  liveUrl: string | null;
  hasUnpublishedDesign: boolean;
}) {
  const [device, setDevice] = useState<Device>("desktop");
  const [path, setPath] = useState("");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <DeviceButtons device={device} onChange={setDevice} />
        {pages.length > 1 && (
          <label className="flex items-center gap-2 text-sm">
            Page
            <select value={path} onChange={(e) => setPath(e.target.value)} className="border border-rule bg-card px-2 py-1.5">
              {pages.map((p) => (
                <option key={p.path} value={p.path}>{p.title}</option>
              ))}
            </select>
          </label>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          {hasUnpublishedDesign && (
            <span className="text-accent">
              Showing design changes that aren’t live yet.{" "}
              <Link href="/dashboard/manage/design" className="underline">Publish them</Link>
            </span>
          )}
          {liveUrl ? (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 border border-rule hover:bg-ink/5">
              Open live site ↗
            </a>
          ) : (
            <span className="text-ink-soft">Your site is offline.</span>
          )}
        </div>
      </div>
      <DevicePreview
        key={path}
        src={`/site-preview${path ? `?path=${path}` : ""}`}
        device={device}
        className="min-h-[32rem] flex-1"
      />
    </div>
  );
}
