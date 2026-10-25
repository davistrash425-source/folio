"use client";

 
import { useState } from "react";
import { inputClass } from "@/app/ui/form";
import { ConfirmButton } from "@/app/ui/confirm";
import { newSection, type HeroSection, type Section, type SitePage } from "@/lib/design";
import { Choice, IconButton } from "./ui";
import { PhotoPicker } from "./pickers";
import { type EditorPhoto, type EditorAlbum, type SectionDefaults, SECTION_LABELS, makeId } from "./types";

export function PageSettings({ page, isHome, onChange, onDelete, onMakeHome, suggestSlug, albumSlugs }: {
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
            <ConfirmButton
              label="Delete page"
              message={`Delete the page “${page.title}”?`}
              onConfirm={onDelete}
              className="px-3 py-1.5 text-sm text-accent hover:bg-accent-soft"
              confirmClassName="bg-accent px-3 py-1.5 text-sm text-paper hover:bg-ink"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function SectionCard({ section, index, count, photos, albums, classic, defaults, onChange, onMove, onRemove }: {
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

export function sectionSummary(section: Section, albums: EditorAlbum[]) {
  switch (section.type) {
    case "hero":
      return section.style === "cover" ? "with photo" : "no photo";
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

export function SectionSettings({ section, photos, albums, classic, defaults, onChange }: {
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
          <HeaderPhotoSettings section={section} photos={photos} onChange={onChange} />
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
          <p className="text-xs text-ink-soft">Leave it empty to use the bio from “About you” below{defaults.bio ? " (shown in grey)" : ""}.</p>
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

// Whether a header shows a photo across the whole window, and which one.
export function HeaderPhotoSettings({ section, photos, onChange }: {
  section: HeroSection;
  photos: EditorPhoto[];
  onChange: (next: HeroSection) => void;
}) {
  return (
    <>
      <Choice
        label="Header photo"
        value={section.style}
        options={[
          ["title", "No photo"],
          ["cover", "Full-width photo"],
        ]}
        onChange={(style) => onChange({ ...section, style })}
      />
      {section.style === "cover" && (
        <div>
          <p className="label mb-2 text-ink-soft">Which photo</p>
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

// The header photo for the page being edited, above its section list so it's
// easy to find. It edits the page's Header section, adding one at the top if
// the page has none.
export function PageHeaderPhoto({ page, photos, onChange }: {
  page: SitePage;
  photos: EditorPhoto[];
  onChange: (sections: Section[]) => void;
}) {
  const hero = page.sections.find((s): s is HeroSection => s.type === "hero");
  return (
    <div className="space-y-3 border border-rule bg-paper p-3">
      {hero ? (
        <HeaderPhotoSettings
          section={hero}
          photos={photos}
          // Choosing a photo shows the header if it was hidden.
          onChange={(next) =>
            onChange(page.sections.map((s) => (s.id === hero.id ? { ...next, visible: next.style === "cover" || next.visible } : s)))
          }
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">This page has no header.</p>
          <button
            type="button"
            onClick={() => onChange([{ ...(newSection("hero", makeId) as HeroSection), style: "cover" }, ...page.sections])}
            className="border border-rule px-3 py-1.5 text-sm hover:border-ink"
          >
            Add a header photo
          </button>
        </div>
      )}
    </div>
  );
}

