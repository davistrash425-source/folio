"use client";

/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { discardDraftDesign, publishDesign, saveDraftDesign, undoDesign, type DesignResult } from "@/app/actions/design";
import { Button, inputClass } from "@/app/ui/form";
import {
  PAGE_TEMPLATES,
  THEMES,
  applyTheme,
  designSchema,
  newPage,
  newSection,
  sameDesign,
  uniqueSlug,
  type PageTemplate,
  type Section,
  type SectionType,
  type SiteDesign,
  type SitePage,
  type ThemeId,
} from "@/lib/design";
import { TEMPLATES } from "@/lib/templates";
import { DevicePreview, DeviceButtons, type Device } from "./device-preview";

export type EditorPhoto = { id: string; src: string; srcSet?: string; description: string; location: string };
export type EditorAlbum = { id: string; slug: string; title: string; photoCount: number };

const SECTION_LABELS: Record<SectionType, string> = {
  hero: "Header",
  gallery: "Gallery",
  albums: "Album links",
  about: "About (your bio)",
  text: "Text",
  contact: "Contact form",
};

const PAGE_TEMPLATE_LABELS: Record<PageTemplate, string> = {
  gallery: "Gallery page",
  about: "About page",
  contact: "Contact page",
  blank: "Blank page",
};

const makeId = () => crypto.randomUUID();

export function DesignEditor(props: {
  draft: SiteDesign;
  published: SiteDesign;
  canUndo: boolean;
  photos: EditorPhoto[];
  albums: EditorAlbum[];
}) {
  const [design, setDesign] = useState(props.draft); // what's on screen
  const [saved, setSaved] = useState(props.draft); // the stored draft
  const [published, setPublished] = useState(props.published);
  const [canUndo, setCanUndo] = useState(props.canUndo);
  const [error, setError] = useState<string>();
  const [device, setDevice] = useState<Device>("desktop");
  const [pageId, setPageId] = useState(props.draft.pages[0].id);
  const [pending, startTransition] = useTransition();

  const unsaved = !sameDesign(design, saved);
  const unpublished = !sameDesign(design, published);
  const problem = useMemo(() => {
    const result = designSchema.safeParse(design);
    return result.success ? null : (result.error.issues[0]?.message ?? "Something in the design isn’t valid.");
  }, [design]);
  const page = design.pages.find((p) => p.id === pageId) ?? design.pages[0];
  const albumSlugs = props.albums.map((a) => a.slug);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  function run(action: () => Promise<DesignResult>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) return setError(result.error);
      if (result.draft) {
        setSaved(result.draft);
        setDesign(result.draft);
      }
      if (result.published) setPublished(result.published);
      setCanUndo(Boolean(result.canUndo));
    });
  }

  const update = (patch: Partial<SiteDesign>) => setDesign((d) => ({ ...d, ...patch }));
  const updatePage = (id: string, patch: Partial<SitePage>) =>
    setDesign((d) => ({ ...d, pages: d.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const setSections = (sections: Section[]) => updatePage(page.id, { sections });

  function addPage(template: PageTemplate) {
    const title = PAGE_TEMPLATES[template].title;
    const slug = uniqueSlug(title, [...design.pages.map((p) => p.slug), ...albumSlugs]);
    const created = newPage(template, slug, makeId);
    setDesign((d) => ({ ...d, pages: [...d.pages, created] }));
    setPageId(created.id);
  }

  const status = unsaved ? "Unsaved changes" : unpublished ? "Draft saved — not live yet" : "Live on your site";

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-30 -mx-6 flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-zinc-50/95 px-6 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border md:bg-white/95">
        <span className={`flex items-center gap-2 text-sm ${unsaved || unpublished ? "text-amber-700" : "text-green-700"}`} aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${unsaved || unpublished ? "bg-amber-500" : "bg-green-600"}`} aria-hidden="true" />
          {status}
        </span>
        {(problem || error) && <span role="alert" className="text-sm text-red-600">{problem ?? error}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          <ToolbarButton
            disabled={pending || (!unsaved && !canUndo)}
            onClick={() => (unsaved ? setDesign(saved) : run(undoDesign))}
            title={unsaved ? "Undo changes since your last save" : "Go back to your previous saved draft"}
          >
            Undo
          </ToolbarButton>
          <ToolbarButton
            disabled={pending || !unpublished}
            onClick={() => {
              if (confirm("Discard all changes that aren’t live yet?")) run(discardDraftDesign);
            }}
          >
            Discard
          </ToolbarButton>
          <ToolbarButton disabled={pending || !unsaved || Boolean(problem)} onClick={() => run(() => saveDraftDesign(design))}>
            Save draft
          </ToolbarButton>
          <Button disabled={pending || !unpublished || Boolean(problem)} onClick={() => run(() => publishDesign(design))} className="h-9">
            {pending ? "Saving…" : "Publish changes"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[26rem_1fr]">
        <div className="space-y-4">
          <AiPlaceholder />

          <Group title="Pages">
            <ul className="space-y-1">
              {design.pages.map((p, i) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 ${p.id === page.id ? "bg-black text-white ring-black" : "bg-zinc-50 ring-zinc-200"}`}
                >
                  <button type="button" onClick={() => setPageId(p.id)} aria-pressed={p.id === page.id} className="flex flex-1 items-baseline gap-2 text-left">
                    <span className="font-medium">{p.title || "Untitled"}</span>
                    <span className={p.id === page.id ? "text-white/60" : "text-zinc-400"}>/{p.slug}</span>
                    {!p.showInNav && <span className={p.id === page.id ? "text-white/60" : "text-zinc-400"}>· hidden from menu</span>}
                  </button>
                  {i > 0 && (
                    <>
                      <IconButton label={`Move ${p.title} up`} disabled={i === 1} onClick={() => update({ pages: swap(design.pages, i, i - 1) })}>↑</IconButton>
                      <IconButton label={`Move ${p.title} down`} disabled={i === design.pages.length - 1} onClick={() => update({ pages: swap(design.pages, i, i + 1) })}>↓</IconButton>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <AddMenu
              label="Add page"
              options={(Object.keys(PAGE_TEMPLATE_LABELS) as PageTemplate[]).map((t) => [t, PAGE_TEMPLATE_LABELS[t]])}
              onAdd={addPage}
              disabled={design.pages.length >= 20}
            />
            <p className="text-xs text-zinc-500">The first page is your home page. Menu order follows this list.</p>
          </Group>

          <Group title={`Page: ${page.title || "Untitled"}`} key={page.id}>
            <PageSettings
              page={page}
              isHome={page.id === design.pages[0].id}
              onChange={(patch) => updatePage(page.id, patch)}
              onDelete={() => {
                if (!confirm(`Delete the page “${page.title}”?`)) return;
                setDesign((d) => ({ ...d, pages: d.pages.filter((p) => p.id !== page.id) }));
                setPageId(design.pages[0].id);
              }}
              suggestSlug={(title) => uniqueSlug(title, [...design.pages.filter((p) => p.id !== page.id).map((p) => p.slug), ...albumSlugs])}
              albumSlugs={albumSlugs}
            />
            <div>
              <p className="mb-2 text-sm font-medium">Sections (top to bottom)</p>
              {page.sections.length === 0 && <p className="mb-2 text-sm text-zinc-500">This page has no sections yet.</p>}
              <ul className="space-y-2">
                {page.sections.map((section, i) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    index={i}
                    count={page.sections.length}
                    photos={props.photos}
                    albums={props.albums}
                    onChange={(next) => setSections(page.sections.map((s) => (s.id === section.id ? next : s)))}
                    onMove={(to) => setSections(swap(page.sections, i, to))}
                    onRemove={() => setSections(page.sections.filter((s) => s.id !== section.id))}
                  />
                ))}
              </ul>
            </div>
            <AddMenu
              label="Add section"
              options={(Object.keys(SECTION_LABELS) as SectionType[]).map((t) => [t, SECTION_LABELS[t]])}
              onAdd={(type) => setSections([...page.sections, newSection(type, makeId)])}
              disabled={page.sections.length >= 30}
            />
          </Group>

          <Group title="Theme">
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((id) => (
                <ThemeCard key={id} id={id} active={design.theme === id} onClick={() => setDesign((d) => applyTheme(d, id))} />
              ))}
            </div>
            <p className="text-xs text-zinc-500">Switching theme changes colors, fonts, gallery style and header style. Your pages stay.</p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["background", "Background"],
                  ["text", "Text"],
                  ["muted", "Secondary text"],
                  ["accent", "Links & buttons"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="color"
                    value={design.colors[key]}
                    onChange={(e) => update({ colors: { ...design.colors, [key]: e.target.value } })}
                    className="h-8 w-10 cursor-pointer rounded border border-zinc-300"
                  />
                  {label}
                </label>
              ))}
            </div>
            <Choice
              label="Fonts"
              value={design.fonts}
              options={[
                ["sans", "Sans-serif"],
                ["serif", "Serif"],
                ["mixed", "Serif headings"],
              ]}
              onChange={(fonts) => update({ fonts })}
            />
          </Group>

          <Group title="Gallery style">
            <p className="text-xs text-zinc-500">Used by every gallery and album page, unless a gallery picks its own layout.</p>
            <Choice
              label="Layout"
              value={design.gallery.layout}
              options={[
                ["grid", "Grid"],
                ["masonry", "Masonry"],
                ["column", "Single column"],
                ["editorial", "Editorial"],
              ]}
              onChange={(layout) => update({ gallery: { ...design.gallery, layout } })}
            />
            <Choice
              label="Columns on large screens (grid and masonry)"
              value={String(design.gallery.columns)}
              options={[
                ["2", "2"],
                ["3", "3"],
                ["4", "4"],
              ]}
              onChange={(c) => update({ gallery: { ...design.gallery, columns: Number(c) as 2 | 3 | 4 } })}
            />
            <Choice
              label="Spacing between photos"
              value={design.gallery.spacing}
              options={[
                ["none", "None"],
                ["tight", "Tight"],
                ["airy", "Airy"],
              ]}
              onChange={(spacing) => update({ gallery: { ...design.gallery, spacing } })}
            />
            <Choice
              label="Photo shape (grid)"
              value={design.gallery.cropping}
              options={[
                ["original", "Original"],
                ["square", "Square"],
                ["portrait", "Portrait 4:5"],
              ]}
              onChange={(cropping) => update({ gallery: { ...design.gallery, cropping } })}
            />
          </Group>

          <Group title="Captions">
            <Choice
              label="Show descriptions under photos"
              value={design.captions.show}
              options={[
                ["none", "None"],
                ["chosen", "Chosen photos"],
                ["all", "All photos"],
              ]}
              onChange={(show) => update({ captions: { ...design.captions, show } })}
            />
            {design.captions.show === "chosen" && (
              <PhotoPicker
                photos={props.photos}
                selected={design.captions.photoIds}
                onChange={(photoIds) => update({ captions: { ...design.captions, photoIds } })}
                hint="Photos without a description or location are dimmed — add them in All photos."
                dimEmpty
              />
            )}
            {design.captions.show !== "none" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={design.captions.includeLocation}
                  onChange={(e) => update({ captions: { ...design.captions, includeLocation: e.target.checked } })}
                />
                Include the photo’s location
              </label>
            )}
          </Group>

          <Group title="Albums">
            <Choice
              label="Albums on your site"
              value={design.albums.show}
              options={[
                ["all", "All albums"],
                ["selected", "Choose albums"],
              ]}
              onChange={(show) =>
                update({
                  albums: { show, albumIds: design.albums.albumIds.length ? design.albums.albumIds : props.albums.map((a) => a.id) },
                })
              }
            />
            {design.albums.show === "selected" && (
              <AlbumPicker albums={props.albums} selected={design.albums.albumIds} onChange={(albumIds) => update({ albums: { ...design.albums, albumIds } })} />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={design.nav.albums} onChange={(e) => update({ nav: { albums: e.target.checked } })} />
              List albums in the site menu
            </label>
            <p className="text-xs text-zinc-500">Each album has its own page. Link to them with an “Album links” section, or show one album with a Gallery section.</p>
          </Group>
        </div>

        <div className="space-y-3 xl:sticky xl:top-20 xl:self-start">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-zinc-500">
              Live preview: <span className="font-medium text-zinc-800">{page.title}</span>
              {unsaved ? " (unsaved)" : ""}
            </p>
            <DeviceButtons device={device} onChange={setDevice} />
          </div>
          <DevicePreview src="/site-preview" device={device} design={design} path={page.slug} className="h-[70vh] min-h-[28rem]" />
        </div>
      </div>
    </div>
  );
}

function PageSettings({ page, isHome, onChange, onDelete, suggestSlug, albumSlugs }: {
  page: SitePage;
  isHome: boolean;
  onChange: (patch: Partial<SitePage>) => void;
  onDelete: () => void;
  suggestSlug: (title: string) => string;
  albumSlugs: string[];
}) {
  // Keep the address following the title until someone edits it by hand.
  const [slugTouched, setSlugTouched] = useState(false);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="font-medium">Page name</span>
          <input
            value={page.title}
            maxLength={40}
            onChange={(e) => {
              const title = e.target.value;
              onChange(isHome || slugTouched ? { title } : { title, slug: suggestSlug(title) });
            }}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Address</span>
          {isHome ? (
            <p className="mt-1 px-1 py-2 text-zinc-500">/ (home page)</p>
          ) : (
            <span className="mt-1 flex items-center rounded-lg border border-zinc-300 bg-white focus-within:border-black focus-within:ring-1 focus-within:ring-black">
              <span className="pl-3 text-zinc-400">/</span>
              <input
                value={page.slug}
                maxLength={40}
                onChange={(e) => {
                  setSlugTouched(true);
                  onChange({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") });
                }}
                className="min-w-0 flex-1 rounded-r-lg py-2 pr-3 text-sm outline-none"
              />
            </span>
          )}
        </label>
      </div>
      {albumSlugs.includes(page.slug) && (
        <p className="text-xs text-amber-700">An album also uses /{page.slug}; this page will show there instead of the album.</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={page.showInNav} onChange={(e) => onChange({ showInNav: e.target.checked })} />
          Show in the site menu
        </label>
        {!isHome && (
          <button type="button" onClick={onDelete} className="rounded-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
            Delete page
          </button>
        )}
      </div>
    </div>
  );
}

function SectionCard({ section, index, count, photos, albums, onChange, onMove, onRemove }: {
  section: Section;
  index: number;
  count: number;
  photos: EditorPhoto[];
  albums: EditorAlbum[];
  onChange: (next: Section) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const label = SECTION_LABELS[section.type];
  const summary = sectionSummary(section, albums);

  return (
    <li className="rounded-lg bg-zinc-50 text-sm ring-1 ring-zinc-200">
      <div className="flex items-center gap-2 px-3 py-2">
        <input
          type="checkbox"
          checked={section.visible}
          onChange={(e) => onChange({ ...section, visible: e.target.checked })}
          aria-label={`Show ${label}`}
          title="Show on the page"
        />
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex flex-1 items-baseline gap-2 text-left">
          <span className={section.visible ? "font-medium" : "font-medium text-zinc-400"}>{label}</span>
          {summary && <span className="truncate text-xs text-zinc-500">{summary}</span>}
        </button>
        <IconButton label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(index - 1)}>↑</IconButton>
        <IconButton label={`Move ${label} down`} disabled={index === count - 1} onClick={() => onMove(index + 1)}>↓</IconButton>
        <IconButton label={`Remove ${label}`} onClick={onRemove}>×</IconButton>
      </div>
      {open && (
        <div className="space-y-4 border-t border-zinc-200 px-3 py-3">
          <SectionSettings section={section} photos={photos} albums={albums} onChange={onChange} />
        </div>
      )}
    </li>
  );
}

function sectionSummary(section: Section, albums: EditorAlbum[]) {
  switch (section.type) {
    case "hero":
      return section.style === "cover" ? "cover photo" : "large title";
    case "gallery": {
      const what =
        section.source.kind === "all"
          ? "all photos"
          : section.source.kind === "photos"
            ? `${section.source.photoIds.length} chosen photos`
            : `album: ${albums.find((a) => section.source.kind === "album" && a.id === section.source.albumId)?.title ?? "missing"}`;
      return section.title ? `${section.title} · ${what}` : what;
    }
    default:
      return section.title;
  }
}

function SectionSettings({ section, photos, albums, onChange }: {
  section: Section;
  photos: EditorPhoto[];
  albums: EditorAlbum[];
  onChange: (next: Section) => void;
}) {
  const titleInput = (placeholder: string) =>
    "title" in section && (
      <label className="block">
        <span className="text-sm font-medium">Heading</span>
        <input
          value={section.title}
          maxLength={80}
          placeholder={placeholder}
          onChange={(e) => onChange({ ...section, title: e.target.value })}
          className={`mt-1 ${inputClass}`}
        />
      </label>
    );

  switch (section.type) {
    case "hero":
      return (
        <>
          <Choice
            label="Style"
            value={section.style}
            options={[
              ["title", "Large title"],
              ["cover", "Full-screen cover photo"],
            ]}
            onChange={(style) => onChange({ ...section, style })}
          />
          {section.style === "cover" && (
            <div>
              <p className="mb-2 text-sm font-medium">Cover photo</p>
              <button
                type="button"
                aria-pressed={section.coverPhotoId === null}
                onClick={() => onChange({ ...section, coverPhotoId: null })}
                className={`mb-2 rounded-full px-3 py-1 text-xs ring-1 ${section.coverPhotoId === null ? "bg-black text-white ring-black" : "ring-zinc-300"}`}
              >
                Automatic (first photo on the page)
              </button>
              <PhotoPicker
                photos={photos}
                selected={section.coverPhotoId ? [section.coverPhotoId] : []}
                single
                onChange={([id]) => onChange({ ...section, coverPhotoId: id ?? null })}
              />
            </div>
          )}
        </>
      );
    case "gallery":
      return (
        <>
          {titleInput("Optional, e.g. Recent work")}
          <Choice
            label="Photos"
            value={section.source.kind}
            options={[
              ["all", "All photos"],
              ["photos", "Choose photos"],
              ["album", "An album"],
            ]}
            onChange={(kind) =>
              onChange({
                ...section,
                source:
                  kind === "photos"
                    ? { kind, photoIds: [] }
                    : kind === "album"
                      ? { kind, albumId: albums[0]?.id ?? "" }
                      : { kind },
              })
            }
          />
          {section.source.kind === "photos" && (
            <PhotoPicker
              photos={photos}
              selected={section.source.photoIds}
              ordered
              onChange={(photoIds) => onChange({ ...section, source: { kind: "photos", photoIds } })}
              hint="Click photos in the order they should appear."
            />
          )}
          {section.source.kind === "album" &&
            (albums.length === 0 ? (
              <p className="text-sm text-zinc-500">You don’t have any albums yet.</p>
            ) : (
              <label className="block text-sm">
                <span className="font-medium">Album</span>
                <select
                  value={section.source.albumId}
                  onChange={(e) => onChange({ ...section, source: { kind: "album", albumId: e.target.value } })}
                  className={`mt-1 ${inputClass}`}
                >
                  {albums.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.photoCount})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          <Choice
            label="Layout"
            value={section.layout}
            options={[
              ["default", "Site style"],
              ["grid", "Grid"],
              ["masonry", "Masonry"],
              ["column", "Column"],
              ["editorial", "Editorial"],
            ]}
            onChange={(layout) => onChange({ ...section, layout })}
          />
        </>
      );
    case "text":
      return (
        <>
          {titleInput("Optional")}
          <label className="block">
            <span className="text-sm font-medium">Text</span>
            <textarea
              value={section.body}
              rows={5}
              maxLength={5000}
              onChange={(e) => onChange({ ...section, body: e.target.value })}
              className={`mt-1 ${inputClass}`}
            />
          </label>
        </>
      );
    case "about":
      return (
        <>
          {titleInput("About")}
          <p className="text-xs text-zinc-500">Shows the bio from your Account page.</p>
        </>
      );
    case "albums":
      return (
        <>
          {titleInput("Albums")}
          <p className="text-xs text-zinc-500">Shows a card for each album on your site (see Albums below).</p>
        </>
      );
    case "contact":
      return (
        <>
          {titleInput("Contact")}
          <p className="text-xs text-zinc-500">Your contact details and a message form.</p>
        </>
      );
  }
}

function swap<T>(list: T[], a: number, b: number) {
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details open className="group rounded-2xl bg-white ring-1 ring-zinc-200">
      <summary className="cursor-pointer list-none px-5 py-4 font-semibold">
        <span className="mr-2 inline-block transition group-open:rotate-90" aria-hidden="true">›</span>
        {title}
      </summary>
      <div className="space-y-5 px-5 pb-5">{children}</div>
    </details>
  );
}

function AddMenu<T extends string>({ label, options, onAdd, disabled }: {
  label: string;
  options: [T, string][];
  onAdd: (value: T) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(options[0][0]);
  return (
    <div className="flex gap-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value as T)}
        aria-label={`${label}: type`}
        className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>{text}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAdd(value)}
        className="rounded-full px-4 py-1.5 text-sm font-medium ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-40"
      >
        + {label}
      </button>
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={`rounded-full px-3 py-1.5 text-sm ring-1 ${value === v ? "bg-black text-white ring-black" : "ring-zinc-300 hover:bg-zinc-100"}`}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ThemeCard({ id, active, onClick }: { id: ThemeId; active: boolean; onClick: () => void }) {
  const t = TEMPLATES.find((x) => x.id === id)!;
  const swatch = { minimal: "bg-white", dark: "bg-zinc-900", editorial: "bg-stone-100" }[id];
  const bar = { minimal: "bg-zinc-200", dark: "bg-zinc-600", editorial: "bg-stone-300" }[id];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={t.description}
      className={`rounded-xl p-2 text-left text-xs ring-1 ${active ? "ring-2 ring-black" : "ring-zinc-200 hover:ring-zinc-400"}`}
    >
      <span className={`mb-2 grid h-12 grid-cols-3 gap-0.5 rounded-md p-1 ring-1 ring-zinc-200 ${swatch}`}>
        <span className={`rounded-sm ${bar}`} />
        <span className={`rounded-sm ${bar}`} />
        <span className={`rounded-sm ${bar}`} />
      </span>
      <span className="font-medium">{t.name}</span>
    </button>
  );
}

function PhotoPicker({ photos, selected, onChange, ordered, single, hint, dimEmpty }: {
  photos: EditorPhoto[];
  selected: string[];
  onChange: (ids: string[]) => void;
  ordered?: boolean;
  single?: boolean;
  hint?: string;
  dimEmpty?: boolean;
}) {
  if (photos.length === 0) return <p className="text-sm text-zinc-500">Upload photos first.</p>;
  return (
    <div>
      {hint && <p className="mb-2 text-xs text-zinc-500">{hint}</p>}
      {!single && (
        <div className="mb-2 flex gap-3 text-xs">
          <button type="button" className="underline" onClick={() => onChange(photos.map((p) => p.id))}>Select all</button>
          <button type="button" className="underline" onClick={() => onChange([])}>Clear</button>
          <span className="text-zinc-500">{selected.length} selected</span>
        </div>
      )}
      <ul className="grid max-h-64 grid-cols-5 gap-1.5 overflow-y-auto pr-1">
        {photos.map((p) => {
          const index = selected.indexOf(p.id);
          const on = index !== -1;
          const empty = dimEmpty && !p.description && !p.location;
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={p.description || "Photo"}
                title={p.description || undefined}
                onClick={() => onChange(single ? (on ? [] : [p.id]) : on ? selected.filter((id) => id !== p.id) : [...selected, p.id])}
                className={`relative block w-full overflow-hidden rounded-md ring-offset-1 ${on ? "ring-2 ring-black" : empty ? "opacity-40" : "opacity-70 hover:opacity-100"}`}
              >
                <img src={p.src} srcSet={p.srcSet} sizes="80px" alt="" className="aspect-square w-full object-cover" />
                {on && (
                  <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-black px-1 text-[10px] leading-4 text-white">
                    {ordered ? index + 1 : "✓"}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AlbumPicker({ albums, selected, onChange }: {
  albums: EditorAlbum[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (albums.length === 0) return <p className="text-sm text-zinc-500">You don’t have any albums yet.</p>;
  const chosen = selected.flatMap((id) => albums.find((a) => a.id === id) ?? []);
  const others = albums.filter((a) => !selected.includes(a.id));
  return (
    <ul className="space-y-1">
      {[...chosen, ...others].map((a) => {
        const i = selected.indexOf(a.id);
        return (
          <li key={a.id} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200">
            <label className="flex flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={i !== -1}
                onChange={(e) => onChange(e.target.checked ? [...selected, a.id] : selected.filter((id) => id !== a.id))}
              />
              {a.title}
              {a.photoCount === 0 && <span className="text-xs text-zinc-400">(empty — hidden on site)</span>}
            </label>
            {i !== -1 && (
              <>
                <IconButton label={`Move ${a.title} up`} disabled={i === 0} onClick={() => onChange(swap(selected, i, i - 1))}>↑</IconButton>
                <IconButton label={`Move ${a.title} down`} disabled={i === selected.length - 1} onClick={() => onChange(swap(selected, i, i + 1))}>↓</IconButton>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function IconButton({ label, children, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className="rounded px-1.5 opacity-70 hover:bg-zinc-200 hover:opacity-100 disabled:opacity-25"
    >
      {children}
    </button>
  );
}

function ToolbarButton({ children, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="h-9 rounded-full px-4 text-sm font-medium ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

// Where the AI assistant will go: describe a change, review it in the
// preview, then save or publish like any other edit.
function AiPlaceholder() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4">
      <label htmlFor="ai-request" className="text-sm font-medium">Describe a change</label>
      <textarea
        id="ai-request"
        disabled
        rows={2}
        placeholder="e.g. “Add a Weddings page with my wedding album and a contact form” — coming soon"
        className="mt-2 w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-400"
      />
    </div>
  );
}
