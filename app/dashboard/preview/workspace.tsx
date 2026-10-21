"use client";

import Link from "next/link";
import { useState } from "react";
import { DevicePreview, DeviceButtons, type Device } from "../device-preview";

// The site as visitors see it, at a chosen device size. Its own menu and
// links move between pages.
export function PreviewWorkspace({ liveUrl, hasUnpublishedDesign }: {
  liveUrl: string | null;
  hasUnpublishedDesign: boolean;
}) {
  const [device, setDevice] = useState<Device>("desktop");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <DeviceButtons device={device} onChange={setDevice} />
        <p className="text-sm text-ink-soft">Click the menu and links in your site to move between pages.</p>
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
        src="/site-preview"
        device={device}
        className="min-h-[32rem] flex-1"
      />
    </div>
  );
}
