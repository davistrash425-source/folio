"use client";

 
import { useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import { discardDraftDesign, publishDesign, saveDraftDesign, undoDesign, type DesignResult } from "@/app/actions/design";
import { Button } from "@/app/ui/form";
import { ConfirmButton } from "@/app/ui/confirm";
import { PAGE_TEMPLATES, LOOKS, applyLook, applyTheme, designSchema, makeHomePage, newPage, newSection, sameDesign, uniqueSlug, type PageTemplate, type Section, type SectionType, type SiteDesign, type SitePage } from "@/lib/design";
import { THEME_INFO } from "@/lib/themes";
import { DevicePreview, DeviceButtons, type Device } from "./device-preview";
import { countChanges } from "./design/changes";
import { ProfileForm } from "./profile-form";
import type { User } from "@/lib/db";
import { swap, Group, AddMenu, Choice, IconButton, ToolbarButton } from "./design/ui";
import { PhotoPicker, AlbumPicker } from "./design/pickers";
import { ThemePicker, ThemeSettings, ThemeCard } from "./design/themes";
import { PageSettings, SectionCard, PageHeaderPhoto } from "./design/sections";
import { type EditorPhoto, type EditorAlbum, type Profile, SECTION_LABELS, PAGE_TEMPLATE_LABELS } from "./design/types";

export type { EditorPhoto, EditorAlbum } from "./design/types";
import { makeId } from "./design/types";


// Edits save as a draft this long after the last change.
const AUTOSAVE_DELAY = 1000;

// The "Describe a change" box waits for Frank, the AI assistant (parked).
const SHOW_AI_BOX = false;

export function DesignEditor(props: {
  draft: SiteDesign;
  isPro: boolean; // Folio Pro unlocks the extra theme settings
  published: SiteDesign;
  canUndo: boolean;
  photos: EditorPhoto[];
  albums: EditorAlbum[];
  profile: Profile;
  fullProfile: User["profile"]; // for the "About you" form
}) {
  const [design, setDesign] = useState(props.draft); // what's on screen
  const [saved, setSaved] = useState(props.draft); // the stored draft
  const [published, setPublished] = useState(props.published);
  const [canUndo, setCanUndo] = useState(props.canUndo);
  const [error, setError] = useState<string>();
  const [device, setDevice] = useState<Device>("desktop");
  const [pageId, setPageId] = useState(props.draft.pages[0].id);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [showPreview, setShowPreview] = useState(true); // below the large breakpoint
  const lastSent = useRef<SiteDesign | null>(null);
  const toSave = useRef<SiteDesign | null>(null); // for the save when leaving

  const unsaved = !sameDesign(design, saved);
  const unpublished = !sameDesign(design, published);
  const problem = useMemo(() => {
    const result = designSchema.safeParse(design);
    return result.success ? null : (result.error.issues[0]?.message ?? "Something in the design isn’t valid.");
  }, [design]);
  const changes = useMemo(() => countChanges(design, published), [design, published]);
  const page = design.pages.find((p) => p.id === pageId) ?? design.pages[0];
  const albumSlugs = props.albums.map((a) => a.slug);

  // Warn before leaving with changes that haven't saved yet.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  // Saves the draft in the background. What's on screen is left alone, so
  // typing carries on while it saves.
  const autosave = useEffectEvent((next: SiteDesign) => {
    if (lastSent.current && sameDesign(next, lastSent.current)) return;
    lastSent.current = next;
    setSaving(true);
    saveDraftDesign(next, { autosave: true }).then(
      (result) => {
        setSaving(false);
        if (result.error || !result.draft) {
          setSaveError(true);
          return;
        }
        setSaveError(false);
        setSaved(result.draft);
        if (result.published) setPublished(result.published);
        setCanUndo(Boolean(result.canUndo));
      },
      () => {
        setSaving(false);
        setSaveError(true);
        lastSent.current = null; // try again on the next edit
      },
    );
  });

  useEffect(() => {
    toSave.current = unsaved && !problem ? design : null;
    if (!toSave.current) return;
    const timer = setTimeout(() => autosave(design), AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [design, unsaved, problem]);

  // Leaving the page within the dashboard saves what's left.
  useEffect(
    () => () => {
      if (toSave.current) autosave(toSave.current);
    },
    [],
  );

  function run(action: () => Promise<DesignResult>) {
    setError(undefined);
    setSaveError(false);
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

  // At least one: the count is rough, and "unpublished" is exact.
  const changeTotal = Math.max(1, changes);
  const changeCount = `${changeTotal} unpublished change${changeTotal === 1 ? "" : "s"}`;
  const saveState = saveError
    ? "Couldn’t save your draft. Check your connection; it will try again when you next edit."
    : problem
      ? "Not saved yet"
      : saving || unsaved
        ? "Saving…"
        : "Draft saved";
  const status = unpublished ? `${saveState} · ${changeCount}` : saving || unsaved ? saveState : "Live: everything is published";

  return (
    <div className="space-y-4">
      {/* Sits under the dashboard's top bar, which is pinned too (--dash-bar is its height). */}
      <div className="sticky top-[var(--dash-bar,55px)] z-30 -mx-6 flex flex-wrap items-center gap-3 border-b border-rule bg-paper/95 px-6 py-3 backdrop-blur md:mx-0 md:border md:bg-paper/95">
        <span className={`flex items-center gap-2 text-sm ${saveError || unpublished ? "text-accent" : "text-ink"}`} aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${saveError || unpublished ? "bg-accent" : "bg-ink"}`} aria-hidden="true" />
          {status}
        </span>
        {(problem || error) && <span role="alert" className="text-sm text-accent">{problem ?? error}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          <ToolbarButton
            disabled={pending || (!unsaved && !canUndo)}
            onClick={() => (unsaved ? setDesign(saved) : run(undoDesign))}
            title="Go back a step"
          >
            Undo
          </ToolbarButton>
          <ConfirmButton
            label="Discard"
            message="Discard all changes that aren’t live yet?"
            confirmLabel="Discard"
            disabled={pending || !unpublished}
            onConfirm={() => run(discardDraftDesign)}
            className="h-9 px-4 text-sm font-medium border border-rule hover:bg-ink/5 disabled:opacity-40"
            confirmClassName="bg-accent h-9 px-4 text-sm font-medium text-paper hover:bg-ink"
          />
          <Button disabled={pending || !unpublished || Boolean(problem)} onClick={() => run(() => publishDesign(design))} className="h-9">
            {pending ? "Working…" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[26rem_minmax(0,1fr)]">
        {/* Room below for the pinned preview on smaller screens. */}
        <div className={`space-y-4 ${showPreview ? "max-lg:pb-[48vh]" : ""}`}>
          {SHOW_AI_BOX && <AiPlaceholder />}
          <Group title="Theme">
            <ThemePicker theme={design.theme} photos={props.photos} isPro={props.isPro} onPick={(theme) => setDesign((d) => applyTheme(d, theme))} />
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
                <ThemeSettings design={design} onChange={update} isPro={props.isPro} />
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
                setDesign((d) => ({ ...d, pages: d.pages.filter((p) => p.id !== page.id) }));
                setPageId(design.pages[0].id);
              }}
              onMakeHome={() => update({ pages: makeHomePage(design.pages, page.id, albumSlugs) })}
              suggestSlug={(title) => uniqueSlug(title, [...design.pages.filter((p) => p.id !== page.id).map((p) => p.slug), ...albumSlugs])}
              albumSlugs={albumSlugs}
            />
            {design.theme === "classic" && (
              <PageHeaderPhoto
                page={page}
                photos={props.photos}
                onChange={setSections}
              />
            )}
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

          {/* Saved on its own (not part of the draft design), so it shows on the live site once saved. */}
          <Group title="About you">
            <p className="text-sm text-ink-soft">
              Your name, bio and contact details. Saving here updates your site straight away; it isn’t part of the draft below.
            </p>
            <ProfileForm profile={props.fullProfile} compact />
          </Group>
        </div>

        {/* Beside the controls on large screens; pinned to the bottom below that, and can be hidden. */}
        <div
          className={`min-w-0 lg:sticky lg:top-[calc(var(--dash-bar,4rem)+5rem)] lg:block lg:self-start ${
            showPreview ? "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:flex max-lg:h-[45vh] max-lg:flex-col max-lg:border-t max-lg:border-ink max-lg:bg-paper max-lg:px-3 max-lg:pb-2 max-lg:pt-2" : "hidden"
          }`}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 lg:mb-3">
            <p className="text-sm text-ink-soft">
              Preview: <span className="font-medium text-ink">{page.title}</span>
              {unpublished ? " (draft)" : ""}
            </p>
            <div className="flex items-center gap-3">
              <DeviceButtons device={device} onChange={setDevice} />
              <button type="button" onClick={() => setShowPreview(false)} className="label text-ink-soft hover:text-ink lg:hidden">
                Hide
              </button>
            </div>
          </div>
          <DevicePreview
            src="/site-preview"
            device={device}
            design={design}
            path={page.slug}
            className="max-lg:min-h-0 max-lg:flex-1 lg:h-[70vh] lg:min-h-[28rem]"
          />
        </div>
        {!showPreview && (
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="fixed bottom-4 right-4 z-30 border border-ink bg-ink px-4 py-2 text-sm font-medium text-paper shadow-lg lg:hidden"
          >
            Show preview
          </button>
        )}
      </div>
    </div>
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

