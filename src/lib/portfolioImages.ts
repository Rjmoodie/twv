/**
 * Portfolio photos are uploaded straight from a phone or a camera export, so they
 * arrive far larger than any surface that renders them: the widest is a 1280px
 * hero. Downscaling in the browser keeps a 5742x3824 kitchen shot from becoming a
 * 3MB request on a public marketing page.
 */

export const MAX_UPLOAD_DIMENSION = 2200;
export const ACCEPTED_UPLOAD_TYPES = 'image/jpeg,image/png,image/webp';

/** Matches the allowed_mime_types on the pm-portfolio bucket. */
const ENCODERS = [
  { type: 'image/webp', extension: 'webp' },
  { type: 'image/jpeg', extension: 'jpg' },
] as const;

export interface PreparedImage {
  blob: Blob;
  contentType: string;
  extension: string;
}

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Downscales to fit MAX_UPLOAD_DIMENSION and re-encodes, preferring WebP. EXIF
 * orientation is baked in by decoding with `from-image`, so portrait photos taken
 * on a phone stay upright instead of arriving rotated.
 *
 * Returns the original file untouched if it cannot be decoded — an upload that
 * looks slightly heavy beats an upload that silently fails.
 */
export async function prepareImageForUpload(file: File, maxDimension = MAX_UPLOAD_DIMENSION): Promise<PreparedImage> {
  const fallback: PreparedImage = { blob: file, contentType: file.type, extension: file.name.split('.').pop()?.toLowerCase() || 'jpg' };
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return fallback;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return fallback;
  }

  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return fallback;
    context.drawImage(bitmap, 0, 0, width, height);

    for (const encoder of ENCODERS) {
      const blob = await canvasToBlob(canvas, encoder.type, 0.82);
      // Older Safari silently returns a PNG when asked for WebP; only take the
      // result when the encoder actually honoured the request.
      if (blob && blob.type === encoder.type) return { blob, contentType: encoder.type, extension: encoder.extension };
    }
    return fallback;
  } finally {
    bitmap.close();
  }
}

const TITLE_NOISE = /\b(before|after|final|new|photo|img|image|dsc|copy)\b/gi;

/**
 * Photo filenames carry the only context a photo ships with — "5006 Market St
 * Duplex Conversion Facade Before" — so they seed the caption rather than being
 * discarded. The address prefix is dropped when the entry title already says it.
 */
export function captionFromFileName(fileName: string, title = ''): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const titleWords = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const words = base.split(' ');

  // Drop the leading run of words the title already establishes, so
  // "1531 S Ringgold St Kitchen" becomes "Kitchen" on an entry of that name.
  let start = 0;
  while (start < words.length && titleWords.includes(words[start].toLowerCase().replace(/[^a-z0-9]/g, ''))) start += 1;
  const remainder = words.slice(start).join(' ').trim() || base;

  return remainder.charAt(0).toUpperCase() + remainder.slice(1);
}

/** Alt text describes the photo for screen readers; the caption alone is too terse. */
export function altFromCaption(caption: string, title: string): string {
  const subject = caption.replace(TITLE_NOISE, '').replace(/\s+/g, ' ').trim();
  return subject ? `${subject} at ${title}` : title;
}
