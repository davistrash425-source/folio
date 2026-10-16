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
] as const;

export type TemplateId = (typeof TEMPLATES)[number]["id"];

export function isTemplateId(value: unknown): value is TemplateId {
  return TEMPLATES.some((t) => t.id === value);
}
