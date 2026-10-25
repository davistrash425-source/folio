import Image from "next/image";
import homePhotos from "./home-photos.json";

// The owner's photographs, standing in for a photographer's work on the landing
// page. `npm run homepage-photos` makes them from folio-homepage-photos/.
const photos = homePhotos.map((p) => p.name);

// The nth photo, starting over once the list runs out.
export function homePhoto(n: number) {
  return photos[n % photos.length];
}

// Fills its box, cropped to fit; give it a size with `className`. The soft
// background stands in for the photo until it arrives, and the photos load
// eagerly (there are only a couple of dozen, all small), so the theme previews
// don't show empty boxes as they scroll into view.
export function Photo({ name, sizes, className }: { name: string; sizes: string; className?: string }) {
  return (
    <span className={`relative block size-full bg-ink-faint/20 ${className ?? ""}`}>
      <Image src={`/home/${name}.webp`} alt="" fill sizes={sizes} loading="eager" className="object-cover" />
    </span>
  );
}

// A hand-drawn loop of red grease pencil, the way a photographer marks the
// frame they want printed. It draws itself once the frames have developed.
function GreasePencilLoop() {
  return (
    <svg viewBox="0 0 120 90" preserveAspectRatio="none" aria-hidden className="pointer-events-none absolute z-10 -inset-x-[14%] -inset-y-[22%] h-[144%] w-[128%] overflow-visible">
      <path
        d="M70 6 C30 2 4 18 5 46 C6 74 36 86 66 84 C98 82 117 66 115 42 C113 18 92 5 58 8 C50 9 44 11 40 14"
        className="draw stroke-accent"
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// The hero shows the first 12 photos; frame 6 is circled in grease pencil.
const roll = [0, 1, 2].map((row) => [0, 1, 2, 3].map((col) => homePhoto(row * 4 + col)));
const SELECTED = 6;

// The landing page's hero: one roll printed as a contact sheet.
export function ContactSheet() {
  return (
    <figure className="relative rotate-[1.25deg] bg-card p-3 shadow-[0_1px_0_#d6cfc1,0_30px_60px_-30px_rgba(28,26,22,0.45)] sm:p-5">
      <figcaption className="mb-3 flex items-baseline justify-between">
        <span className="label text-ink-faint">Roll 07 · 12 exp.</span>
        <span className="font-film-note text-sm text-accent">selects —</span>
      </figcaption>
      <div className="space-y-2">
        {roll.map((strip, row) => (
          <div key={row} className="bg-[#151311] px-1.5 py-3.5 sm:px-2">
            <div className="grid grid-cols-4 gap-[3px]">
              {strip.map((name, col) => {
                const n = row * 4 + col + 1;
                return (
                  <div key={col} className="relative">
                    <div className="develop aspect-[3/2] overflow-hidden" style={{ animationDelay: `${150 + n * 110}ms` }}>
                      <Photo name={name} sizes="(min-width: 1024px) 140px, 25vw" />
                    </div>
                    <span className="absolute -top-3 left-0.5 font-film-edge text-[8px] leading-3 text-[#c08a3e] sm:text-[9px]">
                      ▸{n} {n}A
                    </span>
                    {n === SELECTED && <GreasePencilLoop />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
}
