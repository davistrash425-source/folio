// Draws a photographer's site with the theme its design names. Used for the
// live site (server) and the dashboard preview (client, with an unsaved
// design), so themes must not use hooks or server-only code themselves.
import type { SiteData } from "@/lib/site-data";
import { ClassicTheme } from "./themes/classic";
import { ContactsheetTheme } from "./themes/contactsheet";
import { ExhibitionTheme } from "./themes/exhibition";
import { FilmstripTheme } from "./themes/filmstrip";
import { IndexTheme } from "./themes/index-theme";
import { MonographTheme } from "./themes/monograph";
import { MosaicTheme } from "./themes/mosaic";
import { StudioTheme } from "./themes/studio";
import { TagTheme } from "./themes/tag";

const THEMES = {
  classic: ClassicTheme,
  exhibition: ExhibitionTheme,
  index: IndexTheme,
  filmstrip: FilmstripTheme,
  contactsheet: ContactsheetTheme,
  monograph: MonographTheme,
  tag: TagTheme,
  mosaic: MosaicTheme,
  studio: StudioTheme,
};

export function SiteRenderer({ site }: { site: SiteData }) {
  const Theme = THEMES[site.design.theme];
  return <Theme site={site} />;
}
