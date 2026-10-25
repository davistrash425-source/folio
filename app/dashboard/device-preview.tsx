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
    <div role="group" aria-label="Preview size" className="flex gap-4">
      {(Object.keys(DEVICES) as Device[]).map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={device === d}
          onClick={() => onChange(d)}
          className={`label border-b py-1 transition-colors ${device === d ? "border-accent text-ink" : "border-transparent text-ink-faint hover:text-ink"}`}
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
  // False until the frame says it has drawn the site; shown as "Loading preview…".
  const [ready, setReady] = useState(false);
  const pathRef = useRef(path);
  const framesSeen = useRef(new WeakSet<Window>());

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
      // A hidden box drops the frame; a new one loads when it shows again.
      if (entry.contentRect.width === 0) setReady(false);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Any frame without a design to send is ready once it has loaded.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin === window.location.origin && e.data?.type === READY_MESSAGE && e.source === frameRef.current?.contentWindow) {
        setReady(true);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
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
    <div ref={boxRef} className={`relative overflow-hidden bg-ink/10 border border-rule ${className}`}>
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
          onLoad={() => setReady(true)}
          className="absolute top-0 border-0 bg-card"
        />
      )}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center gap-3 bg-card text-sm text-ink-soft" role="status">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-rule border-t-ink" aria-hidden="true" />
          Loading preview…
        </div>
      )}
    </div>
  );
}
