// What the themes are called and what the editor offers for each.
// Browser-safe on purpose: the editor and the site renderer both import it.
import type { ThemeId } from "./design";

export type ThemeInfo = {
  name: string;
  tagline: string;
  description: string;
  // Classic's colors, fonts, gallery layouts and header styles are editable.
  // The creative themes set their own and only offer their own few settings.
  customizable: boolean;
};

export const THEME_INFO: Record<ThemeId, ThemeInfo> = {
  classic: {
    name: "Classic",
    tagline: "Yours to change",
    description: "Clean pages you can restyle completely: pick a look, then change colors, fonts and gallery layouts.",
    customizable: true,
  },
  exhibition: {
    name: "Exhibition",
    tagline: "Walk the wall",
    description: "Your photos hang in one long row you scroll sideways, each with a museum wall label.",
    customizable: false,
  },
  index: {
    name: "Index",
    tagline: "Read the list",
    description: "A big typeset list of your work. Hover a line to see the photo; tap to open it.",
    customizable: false,
  },
  contactsheet: {
    name: "Contact sheet",
    tagline: "Proof and pick",
    description: "Your work as a photographer's proof sheet: rows of numbered frames you click to open. Folio Pro.",
    customizable: false,
  },
  monograph: {
    name: "Monograph",
    tagline: "Turn the page",
    description: "A photo book: one photo to a page with wide margins, captions and page numbers. Folio Pro.",
    customizable: false,
  },
  tag: {
    name: "Tag",
    tagline: "Hit the street",
    description: "Street and graffiti: black pages, black-and-white photos that turn to color on hover, your name in huge outlined letters. Folio Pro.",
    customizable: false,
  },
  filmstrip: {
    name: "Film strip",
    tagline: "Frame by frame",
    description: "Frames on strips of film with sprocket holes, frame numbers and edge markings.",
    customizable: false,
  },
};
