"use client";

import { useEffect, useRef, useState } from "react";
import { DESIGN_MESSAGE, PATH_MESSAGE, READY_MESSAGE } from "@/app/site-preview/live-preview";
import type { SiteDesign } from "@/lib/design";

const DEVICES = {
  desktop: { label: "Desktop", width: 1280 },
  tablet: { label: "Tablet", width: 768 },
  phone: { label: "Phone", width: 390 },
} as const;

export type Device = keyof typeof DEVICES;

export function DeviceButtons({ device, onChange }: { device: Device; onChange: (d: Device) => void }) {
  return (
    <div role="group" aria-label="Preview size" className="flex gap-1 rounded-full bg-zinc-100 p-1 text-sm">
      {(Object.keys(DEVICES) as Device[]).map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={device === d}
          onClick={() => onChange(d)}
          className={`rounded-full px-3 py-1 ${device === d ? "bg-white font-medium shadow-sm ring-1 ring-zinc-200" : "text-zinc-600 hover:text-black"}`}
        >
          {DEVICES[d].label}
        </button>
      ))}
    </div>
  );
}

// The site in an iframe at a real device width, scaled down to fit. When
// `design` is given it's sent to the frame so unsaved changes show live, and
// `path` switches the frame to that page without reloading it.
export function DevicePreview({ src, device, design, path, className = "" }: {
  src: string;
  device: Device;
  design?: SiteDesign;
  path?: string;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const pathRef = useRef(path);
  const framesSeen = useRef(new WeakSet<Window>());

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Send the design now, and again whenever the frame (re)loads.
  useEffect(() => {
    if (!design) return;
    const send = () =>
      frameRef.current?.contentWindow?.postMessage({ type: DESIGN_MESSAGE, design }, window.location.origin);
    send();
    function onMessage(e: MessageEvent) {
      const frame = frameRef.current?.contentWindow;
      if (e.origin !== window.location.origin || e.data?.type !== READY_MESSAGE || !frame || e.source !== frame) return;
      send();
      // Point a newly created frame at the page being edited. Later loads
      // come from clicking links inside the preview, so leave those alone.
      if (pathRef.current !== undefined && !framesSeen.current.has(frame)) {
        framesSeen.current.add(frame);
        frame.postMessage({ type: PATH_MESSAGE, path: pathRef.current }, window.location.origin);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [design]);

  useEffect(() => {
    pathRef.current = path;
    if (path === undefined) return;
    frameRef.current?.contentWindow?.postMessage({ type: PATH_MESSAGE, path }, window.location.origin);
  }, [path]);

  const width = DEVICES[device].width;
  const scale = box.width ? Math.min(1, box.width / width) : 1;

  return (
    <div ref={boxRef} className={`relative overflow-hidden rounded-xl bg-zinc-200 ring-1 ring-zinc-300 ${className}`}>
      {box.width > 0 && (
        <iframe
          ref={frameRef}
          src={src}
          title="Site preview"
          style={{
            width,
            height: box.height / scale,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            left: Math.max(0, (box.width - width * scale) / 2),
          }}
          className="absolute top-0 border-0 bg-white"
        />
      )}
    </div>
  );
}
