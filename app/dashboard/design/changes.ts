import type { SiteDesign } from "@/lib/design";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Roughly how many things differ between the draft and the live design, for
// "3 unpublished changes": each changed setting (colors, fonts, theme…),
// each added or removed page, each page whose name, address or menu entry
// changed, each added, removed or edited section, and the page order.
export function countChanges(draft: SiteDesign, live: SiteDesign): number {
  let n = 0;
  const keys = new Set([...Object.keys(draft), ...Object.keys(live)]);
  keys.delete("pages");
  for (const key of keys) {
    if (!same(draft[key as keyof SiteDesign], live[key as keyof SiteDesign])) n++;
  }

  const livePages = new Map(live.pages.map((p) => [p.id, p]));
  const draftIds = new Set(draft.pages.map((p) => p.id));
  for (const page of draft.pages) {
    const before = livePages.get(page.id);
    if (!before) {
      n++;
      continue;
    }
    const { sections, ...rest } = page;
    const { sections: sectionsBefore, ...restBefore } = before;
    if (!same(rest, restBefore)) n++;
    const oldSections = new Map(sectionsBefore.map((s) => [s.id, s]));
    for (const section of sections) {
      const old = oldSections.get(section.id);
      if (!old || !same(section, old)) n++;
    }
    const newIds = new Set(sections.map((s) => s.id));
    n += sectionsBefore.filter((s) => !newIds.has(s.id)).length;
    const kept = (list: { id: string }[], other: Set<string>) => list.filter((s) => other.has(s.id)).map((s) => s.id).join();
    if (kept(sections, new Set(oldSections.keys())) !== kept(sectionsBefore, newIds)) n++;
  }
  n += live.pages.filter((p) => !draftIds.has(p.id)).length;
  const order = (list: { id: string }[], other: Set<string>) => list.filter((p) => other.has(p.id)).map((p) => p.id).join();
  if (order(draft.pages, new Set(livePages.keys())) !== order(live.pages, draftIds)) n++;
  return n;
}
