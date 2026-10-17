// Names and descriptions of Classic's looks (see LOOKS in lib/design.ts).
// A look's id is also what accounts record as the template they started
// with, which is why this is still called TemplateId.
export const TEMPLATES = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean white page with an even photo grid.",
  },
  {
    id: "dark",
    name: "Gallery Dark",
    description: "Black backdrop and a masonry layout that lets color pop.",
  },
  {
    id: "editorial",
    name: "Editorial",
    description: "Serif type, a full-bleed cover photo and large images.",
  },
  {
    id: "darkroom",
    name: "Darkroom",
    description: "Near-black under a safelight-red glow, with typewriter type.",
  },
  {
    id: "contact-sheet",
    name: "Contact Sheet",
    description: "Tight rows of square frames on film-rebate black, like a proof sheet.",
  },
  {
    id: "sepia",
    name: "Sepia Print",
    description: "Warm toned paper and serif type, like an old silver print.",
  },
  {
    id: "polaroid",
    name: "Polaroid",
    description: "Square instant-film frames with roomy white borders.",
  },
  {
    id: "noir",
    name: "Film Noir",
    description: "Black and gold, one big photo after another.",
  },
  {
    id: "cyanotype",
    name: "Cyanotype",
    description: "Deep Prussian blue with white type, like a sun print.",
  },
  {
    id: "kodachrome",
    name: "Kodachrome",
    description: "Cream, red and a dense grid of squares with vintage-slide warmth.",
  },
  {
    id: "magazine",
    name: "Magazine",
    description: "Crisp white spreads, serif headlines and a red masthead accent.",
  },
  {
    id: "desert",
    name: "Desert Dusk",
    description: "Sand and terracotta, with a cover photo and editorial spreads.",
  },
  {
    id: "forest",
    name: "Forest Floor",
    description: "Deep moss green with lichen accents, for landscape and nature work.",
  },
  {
    id: "riso",
    name: "Risograph",
    description: "Blue ink, hot pink and mono type, like a small-press zine.",
  },
  {
    id: "neon",
    name: "Neon Night",
    description: "Midnight purple and electric pink, with edge-to-edge photos.",
  },
  {
    id: "concrete",
    name: "Concrete",
    description: "Raw gray, safety orange and a tall, seamless grid.",
  },
  {
    id: "sorbet",
    name: "Sorbet",
    description: "Soft blush pastels and an airy masonry layout.",
  },
] as const;

export type TemplateId = (typeof TEMPLATES)[number]["id"];

export function isTemplateId(value: unknown): value is TemplateId {
  return TEMPLATES.some((t) => t.id === value);
}
