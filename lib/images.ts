// Turns an uploaded photo into the web-sized copies the public site serves.
// sharp drops EXIF/GPS metadata unless asked to keep it, so none of the
// served files reveal where or with what a photo was taken.
// Uses relative imports only, so scripts/ can run it directly with Node.
import sharp from "sharp";

// Widths the public site picks from with srcset.
export const VARIANT_WIDTHS = [640, 1280, 2048] as const;

export type ProcessedImage = {
  width: number;
  height: number;
  variants: { width: number; data: Buffer }[];
};

export async function processImage(input: Buffer): Promise<ProcessedImage> {
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
    widths.map(async (w) => ({
      width: w,
      // rotate() with no angle applies the EXIF orientation before it is dropped.
      data: await sharp(input, { animated: true })
        .rotate()
        .resize({ width: w })
        .webp({ quality: 82 })
        .toBuffer(),
    })),
  );
  return { width, height, variants };
}

export function variantName(base: string, width: number) {
  return `${base}-${width}.webp`;
}
