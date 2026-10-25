"use client";

/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import { FILM_STOCKS, INDEX_SORTS, CLASSIC_LOOKS, THEMES, WALLS, type SiteDesign, type LookId, type ThemeId } from "@/lib/design";
import { TEMPLATES } from "@/lib/templates";
import { THEME_INFO } from "@/lib/themes";
import { Choice } from "./ui";
import { type EditorPhoto } from "./types";

// The four themes, each drawn as a miniature of its layout using the
// photographer's own photos.
export function ThemePicker({ theme, photos, onPick }: { theme: ThemeId; photos: EditorPhoto[]; onPick: (theme: ThemeId) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {THEMES.map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={theme === id}
          onClick={() => onPick(id)}
          className={`border p-2 text-left transition-colors ${theme === id ? "border-ink ring-1 ring-ink" : "border-rule hover:border-ink"}`}
        >
          <ThemeArt theme={id} photos={photos} />
          <span className="mt-2 block font-display text-xl leading-none">{THEME_INFO[id].name}</span>
          <span className="label mt-1 block text-ink-faint">{THEME_INFO[id].tagline}</span>
          <span className="mt-1.5 block text-xs text-ink-soft">
            {id === "classic"
              ? "You choose the layout, colors and fonts."
              : "Sets its own layout and colors. Full editing comes with Pro."}
          </span>
        </button>
      ))}
    </div>
  );
}

export function ThemeArt({ theme, photos }: { theme: ThemeId; photos: EditorPhoto[] }) {
  const pic = (i: number, className: string) =>
    photos[i] ? (
      <img src={photos[i].src} srcSet={photos[i].srcSet} sizes="80px" alt="" className={`${className} object-cover`} />
    ) : (
      <span className={`${className} bg-ink/15`} />
    );

  switch (theme) {
    case "classic":
      return (
        <span className="block h-20 overflow-hidden border border-rule bg-white p-1.5">
          <span className="mb-1 block h-1 w-1/3 bg-zinc-800" />
          <span className="grid grid-cols-3 gap-0.5">
            {pic(0, "h-12 w-full")}
            {pic(1, "h-12 w-full")}
            {pic(2, "h-12 w-full")}
          </span>
        </span>
      );
    case "exhibition":
      return (
        <span className="flex h-20 items-center gap-2 overflow-hidden bg-[#2a2926] px-2">
          <span className="block h-1 w-5 shrink-0 bg-[#ece7dc]/70" />
          <span className="block shrink-0 bg-[#f6f2e8] p-0.5 shadow-md">{pic(0, "h-12 w-9")}</span>
          <span className="block shrink-0 bg-[#f6f2e8] p-0.5 shadow-md">{pic(1, "h-10 w-12")}</span>
          <span className="block shrink-0 bg-[#f6f2e8] p-0.5 shadow-md">{pic(2, "h-12 w-9")}</span>
        </span>
      );
    case "index":
      return (
        <span className="flex h-20 flex-col justify-center overflow-hidden bg-white px-2">
          {[60, 42, 54].map((w, i) => (
            <span key={w} className={`flex items-center justify-between border-t border-black py-1 ${i === 1 ? "bg-[#e5322d]" : ""}`}>
              <span className={`block h-2 ${i === 1 ? "bg-white" : "bg-black"}`} style={{ width: `${w}%` }} />
              {i === 1 && pic(0, "h-3 w-5")}
            </span>
          ))}
        </span>
      );
    case "filmstrip":
      return (
        <span className="flex h-20 items-center overflow-hidden bg-[#14100c] px-1">
          <span className="block w-full bg-[#2b1c0e] py-0.5">
            <span className="flex justify-around py-0.5">
              {Array.from({ length: 12 }, (_, i) => <span key={i} className="block h-1 w-1.5 rounded-[1px] bg-[#14100c]" />)}
            </span>
            <span className="flex gap-1 px-1 py-0.5">
              {pic(0, "h-9 w-8 border-2 border-black")}
              {pic(1, "h-9 w-12 border-2 border-black")}
              {pic(2, "h-9 w-8 border-2 border-black")}
            </span>
            <span className="flex justify-around py-0.5">
              {Array.from({ length: 12 }, (_, i) => <span key={i} className="block h-1 w-1.5 rounded-[1px] bg-[#14100c]" />)}
            </span>
          </span>
        </span>
      );
  }
}

// The few settings each creative theme offers.
export function ThemeSettings({ design, onChange }: { design: SiteDesign; onChange: (patch: Partial<SiteDesign>) => void }) {
  const settings = design.themeSettings;
  const set = <K extends keyof typeof settings>(key: K, patch: Partial<(typeof settings)[K]>) =>
    onChange({ themeSettings: { ...settings, [key]: { ...settings[key], ...patch } } });

  switch (design.theme) {
    case "exhibition":
      return (
        <>
          <Choice
            label="Wall color"
            value={settings.exhibition.wall}
            options={WALLS.map((w) => [w, w[0].toUpperCase() + w.slice(1)] as [typeof w, string])}
            onChange={(wall) => set("exhibition", { wall })}
          />
          <Choice
            label="Wall labels"
            value={settings.exhibition.labels}
            options={[
              ["below", "Below the photo"],
              ["beside", "Beside the photo"],
            ]}
            onChange={(labels) => set("exhibition", { labels })}
          />
        </>
      );
    case "index":
      return (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="color"
              value={settings.index.accent}
              onChange={(e) => set("index", { accent: e.target.value })}
              className="h-8 w-10 cursor-pointer border border-rule"
            />
            Highlight color
          </label>
          <Choice
            label="Order of the list"
            value={settings.index.sort}
            options={INDEX_SORTS.map(
              (v) => [v, { manual: "My order", newest: "Newest first", location: "By location" }[v]] as [typeof v, string],
            )}
            onChange={(sort) => set("index", { sort })}
          />
        </>
      );
    case "filmstrip":
      return (
        <>
          <Choice
            label="Film stock"
            value={settings.filmstrip.stock}
            options={FILM_STOCKS.map(
              (v) => [v, { gold: "Gold 400", mono: "Pan 100", slide: "Chrome 64" }[v]] as [typeof v, string],
            )}
            onChange={(stock) => set("filmstrip", { stock })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.filmstrip.frameNumbers} onChange={(e) => set("filmstrip", { frameNumbers: e.target.checked })} />
            Print frame numbers under each frame
          </label>
        </>
      );
    default:
      return null;
  }
}

export function ThemeCard({ id, active, onClick }: { id: LookId; active: boolean; onClick: () => void }) {
  const t = TEMPLATES.find((x) => x.id === id)!;
  // A tiny page in the theme's own colors: a name line, three photo tiles
  // and an accent dot.
  const { colors } = CLASSIC_LOOKS[id];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={t.description}
      className={`border p-2 text-left text-xs ${active ? "border-ink ring-1 ring-ink" : "border-rule hover:border-ink"}`}
    >
      <span
        className="mb-2 flex h-14 flex-col gap-1 rounded-md p-1.5 ring-1 ring-zinc-200"
        style={{ background: colors.background }}
      >
        <span className="flex items-center justify-between">
          <span className="h-1 w-6 rounded-full" style={{ background: colors.text }} />
          <span className="size-1.5 rounded-full" style={{ background: colors.accent }} />
        </span>
        <span className="grid flex-1 grid-cols-3 gap-0.5">
          <span className="rounded-sm opacity-40" style={{ background: colors.muted }} />
          <span className="rounded-sm opacity-40" style={{ background: colors.muted }} />
          <span className="rounded-sm opacity-40" style={{ background: colors.muted }} />
        </span>
      </span>
      <span className="font-medium">{t.name}</span>
    </button>
  );
}

