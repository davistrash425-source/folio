"use client";

/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { discardDraftDesign, publishDesign, saveDraftDesign, undoDesign, type DesignResult } from "@/app/actions/design";
import { Button, chipClass, inputClass } from "@/app/ui/form";
import {
  PAGE_TEMPLATES,
  FILM_STOCKS,
  INDEX_SORTS,
  LOOKS,
  CLASSIC_LOOKS,
  THEMES,
  WALLS,
  applyLook,
  applyTheme,
  designSchema,
  makeHomePage,
  newPage,
  newSection,
  sameDesign,
  uniqueSlug,
  type PageTemplate,
  type Section,
  type SectionType,
  type SiteDesign,
  type SitePage,
  type LookId,
  type ThemeId,
} from "@/lib/design";
import { TEMPLATES } from "@/lib/templates";
import { THEME_INFO } from "@/lib/themes";
import { DevicePreview, DeviceButtons, type Device } from "./device-preview";

export type EditorPhoto = { id: string; src: string; srcSet?: string; description: string; location: string };
export type EditorAlbum = { id: string; slug: string; title: string; photoCount: number };
type Profile = { name: string; location: string; bio: string };
// What a page's Header and About sections show when their boxes are empty.
type SectionDefaults = { heading: string; subheading: string; bio: string };

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
  profile: Profile;
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
      {/* Sits under the dashboard's top bar, which is pinned too (--dash-bar is its height). */}
      <div className="sticky top-[var(--dash-bar,55px)] z-30 -mx-6 flex flex-wrap items-center gap-3 border-b border-rule bg-paper/95 px-6 py-3 backdrop-blur md:mx-0 md:border md:bg-paper/95">
        <span className={`flex items-center gap-2 text-sm ${unsaved || unpublished ? "text-accent" : "text-ink"}`} aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${unsaved || unpublished ? "bg-accent" : "bg-ink"}`} aria-hidden="true" />
          {status}
        </span>
        {(problem || error) && <span role="alert" className="text-sm text-accent">{problem ?? error}</span>}
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

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[26rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <AiPlaceholder />

          <Group title="Pages">
            <ul className="space-y-1">
              {design.pages.map((p, i) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-2 px-3 py-2 text-sm border ${p.id === page.id ? "bg-ink text-paper border-ink" : "bg-paper border-rule"}`}
                >
                  <button type="button" onClick={() => setPageId(p.id)} aria-pressed={p.id === page.id} className="flex flex-1 items-baseline gap-2 text-left">
                    <span className="font-medium">{p.title || "Untitled"}</span>
                    <span className={p.id === page.id ? "text-paper/60" : "text-ink-faint"}>/{p.slug}</span>
                    {!p.showInNav && <span className={p.id === page.id ? "text-paper/60" : "text-ink-faint"}>· hidden from menu</span>}
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
            <p className="text-xs text-ink-soft">The first page is your home page; open another page to make it the home page instead. Menu order follows this list.</p>
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
              onMakeHome={() => update({ pages: makeHomePage(design.pages, page.id, albumSlugs) })}
              suggestSlug={(title) => uniqueSlug(title, [...design.pages.filter((p) => p.id !== page.id).map((p) => p.slug), ...albumSlugs])}
              albumSlugs={albumSlugs}
            />
            <div>
              <p className="label mb-2 text-ink-soft">Sections, top to bottom</p>
              {page.sections.length === 0 && <p className="mb-2 text-sm text-ink-soft">This page has no sections yet.</p>}
              <ul className="space-y-2">
                {page.sections.map((section, i) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    index={i}
                    count={page.sections.length}
                    photos={props.photos}
                    albums={props.albums}
                    classic={design.theme === "classic"}
                    defaults={{
                      heading: page.slug === "" ? props.profile.name : page.title,
                      subheading: page.slug === "" ? props.profile.location : "",
                      bio: props.profile.bio,
                    }}
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
            <ThemePicker theme={design.theme} photos={props.photos} onPick={(theme) => setDesign((d) => applyTheme(d, theme))} />
            <p className="text-sm text-ink-soft">{THEME_INFO[design.theme].description}</p>
            {design.theme === "classic" ? (
              <>
                <p className="label text-ink-soft">Look</p>
                <div className="grid grid-cols-3 gap-2">
                  {LOOKS.map((id) => (
                    <ThemeCard key={id} id={id} active={design.look === id} onClick={() => setDesign((d) => applyLook(d, id))} />
                  ))}
                </div>
                <p className="text-xs text-ink-soft">A look is a starting point: it sets colors, fonts, gallery style and header style. Change any of them below.</p>
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
                        className="h-8 w-10 cursor-pointer rounded border border-rule"
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
                    ["mono", "Mono"],
                  ]}
                  onChange={(fonts) => update({ fonts })}
                />
                <Choice
                  label="Side margins (large screens)"
                  value={design.margins ?? "none"}
                  options={[
                    ["none", "None"],
                    ["medium", "Medium"],
                    ["wide", "Wide"],
                  ]}
                  // "none" is the same as no setting, so going back to it leaves nothing to save.
                  onChange={(margins) => update({ margins: margins === "none" ? undefined : margins })}
                />
              </>
            ) : (
              <>
                <p className="border-l-2 border-accent bg-card px-4 py-3 text-xs text-ink-soft">
                  This theme sets its own layout, colors and fonts. Your photos, pages, captions and albums carry over, and Classic’s settings are kept for when you switch back.
                </p>
                <ThemeSettings design={design} onChange={update} />
              </>
            )}
          </Group>

          {design.theme === "classic" && (
          <Group title="Gallery style">
            <p className="text-xs text-ink-soft">Used by every gallery and album page, unless a gallery picks its own layout.</p>
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
          )}

          <Group title="Captions">
            {design.theme === "index" && (
              <p className="text-xs text-ink-soft">Index always lists each photo’s description and location in its rows. This setting controls the captions in the full-screen viewer.</p>
            )}
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
            <p className="text-xs text-ink-soft">Each album has its own page. Link to them with an “Album links” section, or show one album with a Gallery section.</p>
          </Group>
        </div>

        <div className="min-w-0 space-y-3 lg:sticky lg:top-[calc(var(--dash-bar,4rem)+5rem)] lg:self-start">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              Live preview: <span className="font-medium text-ink">{page.title}</span>
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

function PageSettings({ page, isHome, onChange, onDelete, onMakeHome, suggestSlug, albumSlugs }: {
  page: SitePage;
  isHome: boolean;
  onChange: (patch: Partial<SitePage>) => void;
  onDelete: () => void;
  onMakeHome: () => void;
  suggestSlug: (title: string) => string;
  albumSlugs: string[];
}) {
  // Keep the address following the title until someone edits it by hand.
  const [slugTouched, setSlugTouched] = useState(false);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="label text-ink-soft">Page name</span>
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
          <span className="label text-ink-soft">Address</span>
          {isHome ? (
            <p className="mt-1 px-1 py-2 text-ink-soft">/ (home page)</p>
          ) : (
            <span className="mt-1 flex items-center border border-rule bg-card focus-within:border-ink focus-within:border focus-within:border-ink">
              <span className="pl-3 text-ink-faint">/</span>
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
        <p className="text-xs text-accent">An album also uses /{page.slug}; this page will show there instead of the album.</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={page.showInNav} onChange={(e) => onChange({ showInNav: e.target.checked })} />
          Show in the site menu
        </label>
        {!isHome && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onMakeHome} className="border border-rule px-3 py-1.5 text-sm hover:border-ink">
              Make this the home page
            </button>
            <button type="button" onClick={onDelete} className="px-3 py-1.5 text-sm text-accent hover:bg-accent-soft">
              Delete page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({ section, index, count, photos, albums, classic, defaults, onChange, onMove, onRemove }: {
  section: Section;
  index: number;
  count: number;
  photos: EditorPhoto[];
  albums: EditorAlbum[];
  classic: boolean; // Classic's header styles and gallery layouts apply
  defaults: SectionDefaults;
  onChange: (next: Section) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const label = SECTION_LABELS[section.type];
  const summary = sectionSummary(section, albums);

  return (
    <li className="bg-paper text-sm border border-rule">
      <div className="flex items-center gap-2 px-3 py-2">
        <input
          type="checkbox"
          checked={section.visible}
          onChange={(e) => onChange({ ...section, visible: e.target.checked })}
          aria-label={`Show ${label}`}
          title="Show on the page"
        />
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex flex-1 items-baseline gap-2 text-left">
          <span className={section.visible ? "font-medium" : "font-medium text-ink-faint"}>{label}</span>
          {summary && <span className="truncate text-xs text-ink-soft">{summary}</span>}
        </button>
        <IconButton label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(index - 1)}>↑</IconButton>
        <IconButton label={`Move ${label} down`} disabled={index === count - 1} onClick={() => onMove(index + 1)}>↓</IconButton>
        <IconButton label={`Remove ${label}`} onClick={onRemove}>×</IconButton>
      </div>
      {open && (
        <div className="space-y-4 border-t border-rule px-3 py-3">
          <SectionSettings section={section} photos={photos} albums={albums} classic={classic} defaults={defaults} onChange={onChange} />
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

function SectionSettings({ section, photos, albums, classic, defaults, onChange }: {
  section: Section;
  photos: EditorPhoto[];
  albums: EditorAlbum[];
  classic: boolean;
  defaults: SectionDefaults;
  onChange: (next: Section) => void;
}) {
  const titleInput = (placeholder: string) =>
    "title" in section && (
      <label className="block">
        <span className="label text-ink-soft">Heading</span>
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
    case "hero": {
      // Empty fields fall back to the defaults, shown as placeholders.
      const textFields = (
        <>
          <label className="block">
            <span className="label text-ink-soft">Title</span>
            <input
              value={section.heading ?? ""}
              maxLength={80}
              placeholder={defaults.heading}
              onChange={(e) => onChange({ ...section, heading: e.target.value || undefined })}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="block">
            <span className="label text-ink-soft">Subtitle</span>
            <input
              value={section.subheading ?? ""}
              maxLength={120}
              placeholder={defaults.subheading || "Optional"}
              onChange={(e) => onChange({ ...section, subheading: e.target.value || undefined })}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <p className="text-xs text-ink-soft">Leave a box empty to use the grey text shown in it.</p>
        </>
      );
      if (!classic) return textFields;
      return (
        <>
          {textFields}
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
              <p className="label mb-2 text-ink-soft">Cover photo</p>
              <button
                type="button"
                aria-pressed={section.coverPhotoId === null}
                onClick={() => onChange({ ...section, coverPhotoId: null })}
                className={`mb-2 px-3 py-1 text-xs border ${section.coverPhotoId === null ? "bg-ink text-paper border-ink" : "border-rule"}`}
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
    }
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
              <p className="text-sm text-ink-soft">You don’t have any albums yet.</p>
            ) : (
              <label className="block text-sm">
                <span className="label text-ink-soft">Album</span>
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
          {classic && (
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
          )}
        </>
      );
    case "text":
      return (
        <>
          {titleInput("Optional")}
          <label className="block">
            <span className="label text-ink-soft">Text</span>
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
          <label className="block">
            <span className="label text-ink-soft">Bio</span>
            <textarea
              value={section.body ?? ""}
              rows={6}
              maxLength={5000}
              placeholder={defaults.bio || "A few lines about you and your work."}
              onChange={(e) => onChange({ ...section, body: e.target.value || undefined })}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <p className="text-xs text-ink-soft">Leave it empty to use the bio from your Account page{defaults.bio ? " (shown in grey)" : ""}.</p>
        </>
      );
    case "albums":
      return (
        <>
          {titleInput("Albums")}
          <p className="text-xs text-ink-soft">Shows a card for each album on your site (see Albums below).</p>
        </>
      );
    case "contact":
      return (
        <>
          {titleInput("Contact")}
          <p className="text-xs text-ink-soft">Your contact details and a message form.</p>
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
    <details open className="group border-t border-ink">
      <summary className="flex cursor-pointer list-none items-baseline justify-between py-3">
        <span className="font-display text-2xl">{title}</span>
        <span className="label text-ink-faint group-open:hidden">Show</span>
        <span className="label hidden text-ink-faint group-open:inline">Hide</span>
      </summary>
      <div className="space-y-5 pb-8">{children}</div>
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
        className="flex-1 border border-rule bg-card px-2 py-1.5 text-sm"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>{text}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAdd(value)}
        className="px-4 py-1.5 text-sm font-medium border border-rule hover:bg-ink/5 disabled:opacity-40"
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
      <legend className="label mb-2 text-ink-soft">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={chipClass(value === v)}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// The four themes, each drawn as a miniature of its layout using the
// photographer's own photos.
function ThemePicker({ theme, photos, onPick }: { theme: ThemeId; photos: EditorPhoto[]; onPick: (theme: ThemeId) => void }) {
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
        </button>
      ))}
    </div>
  );
}

function ThemeArt({ theme, photos }: { theme: ThemeId; photos: EditorPhoto[] }) {
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
function ThemeSettings({ design, onChange }: { design: SiteDesign; onChange: (patch: Partial<SiteDesign>) => void }) {
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

function ThemeCard({ id, active, onClick }: { id: LookId; active: boolean; onClick: () => void }) {
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

function PhotoPicker({ photos, selected, onChange, ordered, single, hint, dimEmpty }: {
  photos: EditorPhoto[];
  selected: string[];
  onChange: (ids: string[]) => void;
  ordered?: boolean;
  single?: boolean;
  hint?: string;
  dimEmpty?: boolean;
}) {
  if (photos.length === 0) return <p className="text-sm text-ink-soft">Upload photos first.</p>;
  return (
    <div>
      {hint && <p className="mb-2 text-xs text-ink-soft">{hint}</p>}
      {!single && (
        <div className="mb-2 flex gap-3 text-xs">
          <button type="button" className="underline" onClick={() => onChange(photos.map((p) => p.id))}>Select all</button>
          <button type="button" className="underline" onClick={() => onChange([])}>Clear</button>
          <span className="text-ink-soft">{selected.length} selected</span>
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
                className={`relative block w-full overflow-hidden ring-offset-1 ring-offset-paper ${on ? "ring-2 ring-accent" : empty ? "opacity-40" : "opacity-70 hover:opacity-100"}`}
              >
                <img src={p.src} srcSet={p.srcSet} sizes="80px" alt="" className="aspect-square w-full object-cover" />
                {on && (
                  <span className="absolute right-0.5 top-0.5 min-w-4 bg-ink px-1 text-[10px] leading-4 text-paper">
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
  if (albums.length === 0) return <p className="text-sm text-ink-soft">You don’t have any albums yet.</p>;
  const chosen = selected.flatMap((id) => albums.find((a) => a.id === id) ?? []);
  const others = albums.filter((a) => !selected.includes(a.id));
  return (
    <ul className="space-y-1">
      {[...chosen, ...others].map((a) => {
        const i = selected.indexOf(a.id);
        return (
          <li key={a.id} className="flex items-center gap-2 bg-paper px-3 py-2 text-sm border border-rule">
            <label className="flex flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={i !== -1}
                onChange={(e) => onChange(e.target.checked ? [...selected, a.id] : selected.filter((id) => id !== a.id))}
              />
              {a.title}
              {a.photoCount === 0 && <span className="text-xs text-ink-faint">(empty — hidden on site)</span>}
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
      className="rounded px-1.5 opacity-70 hover:bg-ink/10 hover:opacity-100 disabled:opacity-25"
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
      className="h-9 px-4 text-sm font-medium border border-rule hover:bg-ink/5 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

// Where the AI assistant will go: describe a change, review it in the
// preview, then save or publish like any other edit.
function AiPlaceholder() {
  return (
    <div className="border border-dashed border-rule bg-card p-4">
      <label htmlFor="ai-request" className="label text-ink-soft">Describe a change</label>
      <textarea
        id="ai-request"
        disabled
        rows={2}
        placeholder="e.g. “Add a Weddings page with my wedding album and a contact form” — coming soon"
        className="mt-2 w-full resize-none border border-rule bg-paper px-3 py-2 text-sm text-ink-faint"
      />
    </div>
  );
}
