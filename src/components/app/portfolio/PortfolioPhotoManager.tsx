import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Star, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ACCEPTED_UPLOAD_TYPES, altFromCaption, captionFromFileName, prepareImageForUpload } from '@/lib/portfolioImages';
import type { GalleryPhoto } from './types';

const BUCKET = 'pm-portfolio';

interface PortfolioPhotoManagerProps {
  userId: string;
  title: string;
  photos: GalleryPhoto[];
  featuredUrl: string | null;
  onChange: (photos: GalleryPhoto[], featuredUrl: string | null) => void;
  disabled?: boolean;
}

/** Storage paths are `<user id>/<file>`; recover one from the public URL to delete it. */
const storagePathFromUrl = (url: string) => {
  const marker = `/${BUCKET}/`;
  const index = url.indexOf(marker);
  return index === -1 ? null : decodeURIComponent(url.slice(index + marker.length));
};

const PortfolioPhotoManager = ({ userId, title, photos, featuredUrl, onChange, disabled }: PortfolioPhotoManagerProps) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList) => {
    setUploading(true);
    const added: GalleryPhoto[] = [];
    for (const file of Array.from(files)) {
      const prepared = await prepareImageForUpload(file);
      const safeName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 60);
      const path = `${userId}/${crypto.randomUUID()}-${safeName}.${prepared.extension}`;
      const result = await supabase.storage.from(BUCKET).upload(path, prepared.blob, { contentType: prepared.contentType });
      if (result.error) {
        toast({ title: `${file.name} was not uploaded`, description: result.error.message, variant: 'destructive' });
        continue;
      }
      const caption = captionFromFileName(file.name, title);
      added.push({ url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, caption, alt: altFromCaption(caption, title || caption) });
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
    if (!added.length) return;
    const next = [...photos, ...added];
    onChange(next, featuredUrl ?? next[0].url);
  };

  const remove = async (index: number) => {
    const [removed] = photos.slice(index, index + 1);
    const next = photos.filter((_, position) => position !== index);
    onChange(next, featuredUrl === removed.url ? next[0]?.url ?? null : featuredUrl);
    const path = storagePathFromUrl(removed.url);
    // The row is already updated; a failed delete leaves an unreferenced file
    // rather than a broken gallery, so it is not worth interrupting the edit.
    if (path) await supabase.storage.from(BUCKET).remove([path]);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next, featuredUrl);
  };

  const update = (index: number, patch: Partial<GalleryPhoto>) => {
    onChange(photos.map((photo, position) => position === index ? { ...photo, ...patch } : photo), featuredUrl);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input ref={inputRef} type="file" multiple accept={ACCEPTED_UPLOAD_TYPES} disabled={disabled || uploading} className="max-w-xs"
          onChange={(event) => { if (event.target.files?.length) void upload(event.target.files); }} />
        {uploading && <span className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resizing and uploading…</span>}
      </div>

      {photos.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          <ImagePlus className="mx-auto mb-2 h-6 w-6" />
          Add every photo that tells the story — before and after shots belong together.
        </p>
      ) : (
        <ul className="space-y-2">
          {photos.map((photo, index) => (
            <li key={photo.url} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start">
              <img src={photo.url} alt="" className="h-20 w-28 shrink-0 rounded object-cover" />
              <div className="min-w-0 flex-1 space-y-2">
                <Input value={photo.caption ?? ''} placeholder="Caption, e.g. Rear exterior before" maxLength={160}
                  onChange={(event) => update(index, { caption: event.target.value, alt: altFromCaption(event.target.value, title) })} />
                <Input value={photo.alt ?? ''} placeholder="Alt text for screen readers" maxLength={300} className="text-xs"
                  onChange={(event) => update(index, { alt: event.target.value })} />
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" size="icon" variant={featuredUrl === photo.url ? 'default' : 'outline'} disabled={disabled}
                  title={featuredUrl === photo.url ? 'Cover photo' : 'Use as cover photo'} aria-label="Use as cover photo"
                  onClick={() => onChange(photos, photo.url)}><Star className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="outline" disabled={disabled || index === 0} aria-label="Move earlier" onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="outline" disabled={disabled || index === photos.length - 1} aria-label="Move later" onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="outline" disabled={disabled} aria-label="Remove photo" onClick={() => void remove(index)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {photos.length > 0 && <p className="text-xs text-muted-foreground">The starred photo is the cover used on listing cards and the story header. Landscape photos crop best there.</p>}
    </div>
  );
};

export default PortfolioPhotoManager;
