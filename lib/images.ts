// Turns an uploaded photo into the web-sized copies the public site serves.
// sharp drops EXIF/GPS metadata unless asked to keep it, so none of the
// served files reveal where or with what a photo was taken. The only
// metadata written back is who made the photo and its copyright notice.
// (Colors stay right: sharp converts photos with their own color profile,
// like an iPhone's Display P3, to standard sRGB.)
// Uses relative imports only, so scripts/ can run it directly with Node.
import sharp from "sharp";

// Widths the public site picks from with srcset.
export const VARIANT_WIDTHS = [640, 1280, 2048] as const;

export type ProcessedImage = {
  width: number;
  height: number;
  variants: { width: number; data: Buffer }[];
};

// Written into every web copy, so the photographer's name and notice travel
// with a photo that's saved or copied: EXIF Artist and Copyright (ASCII
// only, so "©" becomes "(C)"), and XMP dc:creator and dc:rights, which keep
// any characters and are what Google Images shows as Creator and Copyright.
// Removing this information from a copy can itself break copyright law
// (17 U.S.C. § 1202), which is part of why it's there.
export type PhotoRights = { artist: string; copyright: string };

export async function processImage(input: Buffer, rights?: PhotoRights): Promise<ProcessedImage> {
  const meta = await sharp(input, { animated: true, failOn: "error" }).metadata();
  // Dimensions as displayed, after the EXIF orientation is applied.
  const { width } = meta.autoOrient;
  // Animated images report the height of all frames stacked; use one frame.
  const height = (meta.pages ?? 1) > 1 ? (meta.pageHeight ?? meta.height) : meta.autoOrient.height;

  // Never upscale: keep the widths smaller than the photo, plus the photo's
  // own width when it is smaller than the largest variant.
  const widths: number[] = VARIANT_WIDTHS.filter((w) => w < width);
  if (width <= VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1]) widths.push(width);

  const variants = await Promise.all(
    widths.map(async (w) => {
      // rotate() with no angle applies the EXIF orientation before it is dropped.
      let image = sharp(input, { animated: true }).rotate().resize({ width: w });
      if (rights) {
        image = image
          .withExif({ IFD0: { Artist: rights.artist, Copyright: rights.copyright } })
          .withXmp(rightsXmp(rights));
      }
      return {
        width: w,
        // effort 2 (of 0-6, default 4) encodes about a third faster for files
        // within a few percent of the size; quality is set separately.
        data: await image.webp({ quality: 82, effort: 2 }).toBuffer(),
      };
    }),
  );
  return { width, height, variants };
}

const xml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function rightsXmp({ artist, copyright }: PhotoRights) {
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/">
   <dc:creator><rdf:Seq><rdf:li>${xml(artist)}</rdf:li></rdf:Seq></dc:creator>
   <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${xml(copyright)}</rdf:li></rdf:Alt></dc:rights>
   <photoshop:Credit>${xml(artist)}</photoshop:Credit>
   <xmpRights:Marked>True</xmpRights:Marked>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export function variantName(base: string, width: number) {
  return `${base}-${width}.webp`;
}
