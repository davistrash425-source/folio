"use client";

import Link from "next/link";
import { useState } from "react";
import { DevicePreview, DeviceButtons, type Device } from "../device-preview";

export function PreviewWorkspace({ albums, liveUrl, hasUnpublishedDesign }: {
  albums: { slug: string; title: string }[];
  liveUrl: string | null;
  hasUnpublishedDesign: boolean;
}) {
  const [device, setDevice] = useState<Device>("desktop");
  const [album, setAlbum] = useState("");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <DeviceButtons device={device} onChange={setDevice} />
        {albums.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            Page
            <select value={album} onChange={(e) => setAlbum(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5">
              <option value="">Home</option>
              {albums.map((a) => (
                <option key={a.slug} value={a.slug}>{a.title}</option>
              ))}
            </select>
          </label>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          {hasUnpublishedDesign && (
            <span className="text-amber-700">
              Showing design changes that aren’t live yet.{" "}
              <Link href="/dashboard/manage/design" className="underline">Publish them</Link>
            </span>
          )}
          {liveUrl ? (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="rounded-full px-3 py-1.5 ring-1 ring-zinc-300 hover:bg-zinc-100">
              Open live site ↗
            </a>
          ) : (
            <span className="text-zinc-500">Your site is offline.</span>
          )}
        </div>
      </div>
      <DevicePreview
        key={album}
        src={`/site-preview${album ? `?album=${album}` : ""}`}
        device={device}
        className="min-h-[32rem] flex-1"
      />
    </div>
  );
}
