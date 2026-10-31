// Fonts for the creative themes. `preload: false` keeps them out of the head
// of pages that don't use them; the browser only downloads a font once text
// on the page actually uses it.
import { Anton, Archivo, Bebas_Neue, Cormorant_Garamond, Jost, Share_Tech_Mono, Space_Grotesk, Space_Mono, Special_Elite } from "next/font/google";

export const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

export const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  preload: false,
});

export const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  display: "swap",
  preload: false,
});

export const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
});

export const shareTech = Share_Tech_Mono({
  variable: "--font-share-tech",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
});

export const specialElite = Special_Elite({
  variable: "--font-elite",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
});

export const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
});

export const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
});

export const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
});
