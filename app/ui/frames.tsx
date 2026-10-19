import Image from "next/image";
import type { ReactNode } from "react";

// Small drawn black-and-white "photographs" for the landing page's theme previews,
// standing in for a photographer's work: flat shapes in the paper and ink tones
// of the app, with film grain from the `grain` class in globals.css.
// Every <Scene> uses the gradients in <SceneDefs>, rendered once per page.

const INK = "#1c1a16";

export function SceneDefs() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <defs>
        <linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ebe7de" />
          <stop offset="1" stopColor="#a9a397" />
        </linearGradient>
        <linearGradient id="fs-dusk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#35312c" />
          <stop offset="1" stopColor="#9a9386" />
        </linearGradient>
        <linearGradient id="fs-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#777166" />
          <stop offset="1" stopColor="#2a2723" />
        </linearGradient>
        <radialGradient id="fs-glow" cx="0.3" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#bdb6a9" />
          <stop offset="1" stopColor="#4d4840" />
        </radialGradient>
      </defs>
    </svg>
  );
}

const pierPosts = Array.from({ length: 10 }, (_, i) => {
  const t = i / 9;
  const h = 26 * (1 - t) + 3;
  return { x: 8 + t * 98, y: 55 - h * 0.45, w: 2.8 * (1 - t) + 0.7, h };
});

const scenes = {
  ridge: (
    <>
      <rect width="150" height="100" fill="url(#fs-dusk)" />
      <circle cx="104" cy="46" r="9" fill="#e8e3d8" />
      <path d="M0 70 L22 52 L38 62 L60 40 L82 60 L100 50 L124 64 L150 54 V100 H0Z" fill="#4a453e" />
      <path d="M0 82 L30 68 L55 78 L85 64 L115 80 L150 70 V100 H0Z" fill={INK} />
    </>
  ),
  shore: (
    <>
      <rect width="150" height="100" fill="url(#fs-sky)" />
      <rect y="58" width="150" height="42" fill="url(#fs-sea)" />
      <rect x="40" y="58" width="9" height="28" fill="#e2ddd2" opacity="0.3" />
      <path d="M0 86 Q75 79 150 88 V100 H0Z" fill="#c4bdb0" />
      <rect x="104" y="74" width="2.4" height="9" fill={INK} />
      <circle cx="105.2" cy="72.4" r="1.7" fill={INK} />
    </>
  ),
  window: (
    <>
      <rect width="150" height="100" fill="#1d1b17" />
      <rect x="52" y="16" width="46" height="60" fill="#dcd6c9" />
      <rect x="74" y="16" width="2" height="60" fill="#1d1b17" />
      <rect x="52" y="44" width="46" height="2" fill="#1d1b17" />
      <path d="M52 76 L98 76 L122 100 L30 100Z" fill="#dcd6c9" opacity="0.16" />
      <circle cx="66" cy="52" r="5" fill="#1d1b17" />
      <path d="M57 76 Q57 60 66 60 Q75 60 75 76Z" fill="#1d1b17" />
    </>
  ),
  portrait: (
    <>
      <rect width="150" height="100" fill="url(#fs-glow)" />
      <ellipse cx="75" cy="42" rx="14" ry="18" fill="#24211d" />
      <path d="M68 56 H82 V66 Q106 70 112 100 H38 Q44 70 68 66Z" fill="#24211d" />
      <path d="M86 29 Q93 42 86 56" stroke="#efeae0" strokeWidth="1.2" fill="none" opacity="0.75" />
    </>
  ),
  tree: (
    <>
      <rect width="150" height="100" fill="url(#fs-sky)" />
      <path d="M0 78 Q75 56 150 76 V100 H0Z" fill="#5c564d" />
      <path d="M96 67 L97.5 48 H100 L101.5 67Z" fill={INK} />
      <circle cx="98.5" cy="42" r="11" fill={INK} />
      <circle cx="90" cy="47" r="7.5" fill={INK} />
      <circle cx="107" cy="47" r="7.5" fill={INK} />
    </>
  ),
  road: (
    <>
      <rect width="150" height="100" fill="#d8d2c6" />
      <path d="M0 52 Q40 43 80 50 Q115 44 150 51 V52Z" fill="#7a7468" />
      <rect y="51" width="150" height="49" fill="#3b3731" />
      <path d="M73 51 L77 51 L120 100 L30 100Z" fill="#8b8478" />
      <path d="M75 53 V100" stroke="#e6e1d6" strokeWidth="1" strokeDasharray="3 4" />
    </>
  ),
  moon: (
    <>
      <rect width="150" height="100" fill="#181613" />
      <circle cx="108" cy="27" r="10" fill="#e4dfd3" />
      <path d="M0 58 Q75 74 150 52" stroke="#5a554d" strokeWidth="0.8" fill="none" />
      <path d="M0 65 Q75 83 150 60" stroke="#5a554d" strokeWidth="0.8" fill="none" />
      <circle cx="34" cy="61.8" r="1.6" fill="#8c8578" />
      <circle cx="40" cy="62.7" r="1.6" fill="#8c8578" />
      <circle cx="45.5" cy="63.3" r="1.6" fill="#8c8578" />
    </>
  ),
  arches: (
    <>
      <rect width="150" height="100" fill="#cfc8bb" />
      {[8, 44, 80, 116].map((x) => (
        <path key={x} d={`M${x} 100 V50 A13 13 0 0 1 ${x + 26} 50 V100Z`} fill="#2a2722" />
      ))}
      <rect x="56" y="86" width="2.4" height="10" fill="#cfc8bb" />
      <circle cx="57.2" cy="84.3" r="1.6" fill="#cfc8bb" />
      <path d="M0 0 H150 V26 L0 70Z" fill="#000" opacity="0.12" />
    </>
  ),
  dunes: (
    <>
      <rect width="150" height="100" fill="url(#fs-sky)" />
      <path d="M0 60 Q40 44 80 58 T150 52 V100 H0Z" fill="#a49d90" />
      <path d="M0 74 Q50 58 100 76 T150 70 V100 H0Z" fill="#6a645a" />
      <path d="M0 88 Q60 76 150 92 V100 H0Z" fill="#2e2a25" />
    </>
  ),
  pier: (
    <>
      <rect width="150" height="100" fill="url(#fs-sky)" />
      <rect y="55" width="150" height="45" fill="url(#fs-sea)" />
      <path d="M8 43 L106 54" stroke={INK} strokeWidth="1.6" />
      {pierPosts.map((p) => (
        <rect key={p.x} x={p.x} y={p.y} width={p.w} height={p.h} fill={INK} />
      ))}
    </>
  ),
  stairs: (
    <>
      <rect width="150" height="100" fill="#c2bbae" />
      <path d="M0 100 V80 H25 V65 H50 V50 H75 V35 H100 V20 H125 V5 H150 V100Z" fill="#3a3630" />
      <rect x="61" y="40" width="2.2" height="10" fill={INK} />
      <circle cx="62.1" cy="38.3" r="1.6" fill={INK} />
    </>
  ),
  bloom: (
    <>
      <rect width="150" height="100" fill="#2b2824" />
      <g transform="translate(75 50)">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse key={a} cy="-17" rx="10" ry="21" transform={`rotate(${a})`} fill="#d2cbbe" fillOpacity="0.5" />
        ))}
        <circle r="7" fill="#3a362f" />
      </g>
    </>
  ),
} satisfies Record<string, ReactNode>;

export type SceneName = keyof typeof scenes;

export function Scene({ name, className }: { name: SceneName; className?: string }) {
  return (
    <span className={`relative block size-full ${className ?? ""}`}>
      <svg viewBox="0 0 150 100" preserveAspectRatio="xMidYMid slice" aria-hidden className="absolute inset-0 size-full">
        {scenes[name]}
      </svg>
      <span className="grain absolute inset-0 opacity-30" />
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

// Real photographs, resized to 600x400 WebP (no EXIF/GPS) in public/home/.
const roll = [
  ["arcade", "mountains", "stop-sign", "car"],
  ["crossing", "yellow-wall", "pagoda", "reflection"],
  ["cafe", "beach", "alley", "orange-house"],
];
const SELECTED = "yellow-wall";

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
                  <div key={name} className="relative">
                    <div className="develop aspect-[3/2] overflow-hidden" style={{ animationDelay: `${150 + n * 110}ms` }}>
                      <Image src={`/home/${name}.webp`} alt="" width={600} height={400} sizes="(min-width: 1024px) 140px, 25vw" className="size-full object-cover" />
                    </div>
                    <span className="absolute -top-3 left-0.5 font-film-edge text-[8px] leading-3 text-[#c08a3e] sm:text-[9px]">
                      ▸{n} {n}A
                    </span>
                    {name === SELECTED && <GreasePencilLoop />}
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
