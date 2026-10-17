// Draws a photographer's site with the theme its design names. Used for the
// live site (server) and the dashboard preview (client, with an unsaved
// design), so themes must not use hooks or server-only code themselves.
import type { SiteData } from "@/lib/site-data";
import { ClassicTheme } from "./themes/classic";
import { ExhibitionTheme } from "./themes/exhibition";
import { FilmstripTheme } from "./themes/filmstrip";
import { IndexTheme } from "./themes/index-theme";

const THEMES = {
  classic: ClassicTheme,
  exhibition: ExhibitionTheme,
  index: IndexTheme,
  filmstrip: FilmstripTheme,
};

export function SiteRenderer({ site }: { site: SiteData }) {
  const Theme = THEMES[site.design.theme];
  return <Theme site={site} />;
}
