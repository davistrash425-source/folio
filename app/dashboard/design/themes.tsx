"use client";

/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import {
  BOOK_PAPERS, CLASSIC_LOOKS, EXHIBITION_FRAMES, FILM_BORDERS, FILM_FRAME_SIZES, FILM_STOCKS, INDEX_SORTS, LABEL_FONTS, PRINT_SIZES,
  PRO_THEMES, ROW_SIZES, SHEET_COLUMNS, SHEET_PAPERS, THEMES, TITLE_CASES, WALLS, type SiteDesign, type LookId, type ThemeId,
} from "@/lib/design";
import { TEMPLATES } from "@/lib/templates";
import { THEME_INFO } from "@/lib/themes";
import { Choice } from "./ui";
import { type EditorPhoto } from "./types";

// Every theme (four free plus the Pro-only ones), each drawn as a miniature of
// its layout using the photographer's own photos.
export function ThemePicker({ theme, photos, onPick, isPro }: { theme: ThemeId; photos: EditorPhoto[]; onPick: (theme: ThemeId) => void; isPro: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {THEMES.map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={theme === id}
          disabled={!isPro && PRO_THEMES.includes(id)}
          onClick={() => onPick(id)}
          className={`border p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${theme === id ? "border-ink ring-1 ring-ink" : "border-rule hover:border-ink"}`}
        >
          <ThemeArt theme={id} photos={photos} />
          <span className="mt-2 block font-display text-xl leading-none">{THEME_INFO[id].name}</span>
          <span className="label mt-1 block text-ink-faint">{THEME_INFO[id].tagline}</span>
          <span className="mt-1.5 block text-xs text-ink-soft">
            {id === "classic"
              ? "You choose the layout, colors and fonts."
              : PRO_THEMES.includes(id)
                ? isPro ? "Folio Pro theme. Sets its own layout and colors." : "Folio Pro: upgrade to use this theme."
                : "Sets its own layout and colors. More settings come with Pro."}
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
    case "contactsheet":
      return (
        <span className="block h-20 overflow-hidden bg-[#d9d5cb] p-1.5">
          <span className="grid h-full grid-cols-4 content-start gap-0.5 bg-[#f4f2ec] p-1">
            {[0, 1, 2, 0, 1, 2, 0, 1].map((n, i) => (
              <span key={i} className="block bg-black p-px">{pic(n, "h-4 w-full")}</span>
            ))}
          </span>
        </span>
      );
    case "monograph":
      return (
        <span className="flex h-20 items-center justify-center gap-1 overflow-hidden bg-white px-3">
          <span className="block w-1/2 bg-white p-2 shadow-sm ring-1 ring-black/10">{pic(0, "h-12 w-full")}</span>
          <span className="block w-1/2 bg-white p-2 shadow-sm ring-1 ring-black/10">{pic(1, "h-12 w-full")}</span>
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

const cap = (v: string) => v[0].toUpperCase() + v.slice(1);

// Two settings per creative theme for everyone, then the Pro ones, which Free
// accounts see locked (the server resets them anyway).
export function ThemeSettings({ design, onChange, isPro }: { design: SiteDesign; onChange: (patch: Partial<SiteDesign>) => void; isPro: boolean }) {
  const settings = design.themeSettings;
  const set = <K extends keyof typeof settings>(key: K, patch: Partial<(typeof settings)[K]>) =>
    onChange({ themeSettings: { ...settings, [key]: { ...settings[key], ...patch } } });
  const locked = !isPro;
  const setPro = <K extends "exhibition" | "index" | "filmstrip">(key: K, patch: Partial<(typeof settings)[K]["pro"]>) =>
    set(key, { pro: { ...settings[key].pro, ...patch } } as unknown as Partial<(typeof settings)[K]>);
  const proNote = (
    <p className="label text-ink-faint">
      {isPro ? "Folio Pro" : "Folio Pro: upgrade to change these"}
    </p>
  );

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
          {proNote}
          <Choice
            label="Mat around each print"
            locked={locked}
            value={settings.exhibition.pro.frame}
            options={EXHIBITION_FRAMES.map((v) => [v, v === "none" ? "No mat" : cap(v)] as [typeof v, string])}
            onChange={(frame) => setPro("exhibition", { frame })}
          />
          <Choice
            label="Print size"
            locked={locked}
            value={settings.exhibition.pro.printSize}
            options={PRINT_SIZES.map((v) => [v, cap(v)] as [typeof v, string])}
            onChange={(printSize) => setPro("exhibition", { printSize })}
          />
          <Choice
            label="Label typeface"
            locked={locked}
            value={settings.exhibition.pro.labelFont}
            options={LABEL_FONTS.map((v) => [v, v === "serif" ? "Serif italic" : "Sans"] as [typeof v, string])}
            onChange={(labelFont) => setPro("exhibition", { labelFont })}
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
          {proNote}
          <Choice
            label="Row size"
            locked={locked}
            value={settings.index.pro.rowSize}
            options={ROW_SIZES.map((v) => [v, cap(v)] as [typeof v, string])}
            onChange={(rowSize) => setPro("index", { rowSize })}
          />
          <Choice
            label="Titles"
            locked={locked}
            value={settings.index.pro.titleCase}
            options={TITLE_CASES.map((v) => [v, v === "upper" ? "UPPERCASE" : "As typed"] as [typeof v, string])}
            onChange={(titleCase) => setPro("index", { titleCase })}
          />
          <label className={`flex items-center gap-2 text-sm ${locked ? "opacity-50" : ""}`}>
            <input type="checkbox" disabled={locked} checked={settings.index.pro.showYear} onChange={(e) => setPro("index", { showYear: e.target.checked })} />
            Show the year column
          </label>
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
          {proNote}
          <Choice
            label="Frame size"
            locked={locked}
            value={settings.filmstrip.pro.frameSize}
            options={FILM_FRAME_SIZES.map((v) => [v, cap(v)] as [typeof v, string])}
            onChange={(frameSize) => setPro("filmstrip", { frameSize })}
          />
          <Choice
            label="Frame border"
            locked={locked}
            value={settings.filmstrip.pro.border}
            options={FILM_BORDERS.map((v) => [v, { black: "Black", edge: "Film color", none: "None" }[v]] as [typeof v, string])}
            onChange={(border) => setPro("filmstrip", { border })}
          />
          <label className={`flex items-center gap-2 text-sm ${locked ? "opacity-50" : ""}`}>
            <input type="checkbox" disabled={locked} checked={settings.filmstrip.pro.sprockets} onChange={(e) => setPro("filmstrip", { sprockets: e.target.checked })} />
            Sprocket holes
          </label>
        </>
      );
    case "contactsheet":
      return (
        <>
          <Choice
            label="Paper"
            value={settings.contactsheet.paper}
            options={SHEET_PAPERS.map((v) => [v, cap(v)] as [typeof v, string])}
            onChange={(paper) => set("contactsheet", { paper })}
          />
          <Choice
            label="Frames per row"
            value={String(settings.contactsheet.columns) as "4" | "6" | "8"}
            options={SHEET_COLUMNS.map((v) => [String(v), String(v)] as ["4" | "6" | "8", string])}
            onChange={(columns) => set("contactsheet", { columns: Number(columns) as 4 | 6 | 8 })}
          />
        </>
      );
    case "monograph":
      return (
        <>
          <Choice
            label="Paper"
            value={settings.monograph.paper}
            options={BOOK_PAPERS.map((v) => [v, cap(v)] as [typeof v, string])}
            onChange={(paper) => set("monograph", { paper })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.monograph.pageNumbers} onChange={(e) => set("monograph", { pageNumbers: e.target.checked })} />
            Page number under each photo
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

