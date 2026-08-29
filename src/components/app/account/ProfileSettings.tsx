import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  theme_preference: string;
  onboarding_completed: boolean;
  profile_completion_score: number;
}

interface ProfileSettingsProps {
  profile: Profile;
  onUpdate: (updates: Partial<Profile>) => Promise<void>;
}

const ProfileSettings = ({ profile, onUpdate }: ProfileSettingsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publicSaving, setPublicSaving] = useState(false);
  const [publicProfile, setPublicProfile] = useState({ handle: '', display_name: profile.username || '', bio: '', is_public: false });
  const [formData, setFormData] = useState({
    username: profile.username || "",
    email: user?.email || profile.email || "",
  });

  const initials =
    (formData.username?.[0] || user?.email?.[0] || "U").toUpperCase();

  useEffect(() => {
    if (!user) return;
    supabase.from('public_profiles').select('handle, display_name, bio, is_public').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) setPublicProfile({ handle: data.handle, display_name: data.display_name, bio: data.bio ?? '', is_public: data.is_public });
    });
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextEmail = formData.email.trim().toLowerCase();
      if (nextEmail && nextEmail !== user?.email?.toLowerCase()) {
        const { error } = await supabase.auth.updateUser({ email: nextEmail }, {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        });
        if (error) throw error;
        toast({ title: 'Confirm your new email', description: 'We sent confirmation links to complete the secure email change.' });
      }
      await onUpdate({ username: formData.username });
      if (!nextEmail || nextEmail === user?.email?.toLowerCase()) toast({ title: 'Profile updated' });
    } catch (cause) {
      toast({ title: 'Profile could not be updated', description: cause instanceof Error ? cause.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 5 MB.", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      if (profile.avatar_url) {
        const old = profile.avatar_url.split("/").pop();
        if (old) await supabase.storage.from("avatars").remove([`${user.id}/${old}`]);
      }
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      await onUpdate({ avatar_url: publicUrl });
      toast({ title: "Photo updated" });
    } catch {
      toast({ title: "Upload failed", description: "Couldn't upload your photo.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const savePublicProfile = async () => {
    if (!user) return;
    const handle = publicProfile.handle.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(handle)) {
      toast({ title: 'Choose a valid public handle', description: 'Use 3–40 lowercase letters, numbers, or hyphens.', variant: 'destructive' });
      return;
    }
    if (!publicProfile.display_name.trim()) { toast({ title: 'Display name is required', variant: 'destructive' }); return; }
    setPublicSaving(true);
    const { error } = await supabase.from('public_profiles').upsert({ user_id: user.id, handle, display_name: publicProfile.display_name.trim(), bio: publicProfile.bio.trim() || null, avatar_url: profile.avatar_url, is_public: publicProfile.is_public, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    setPublicSaving(false);
    if (error) toast({ title: error.code === '23505' ? 'That handle is already taken' : 'Public profile could not be saved', description: 'Your private account profile was not changed.', variant: 'destructive' });
    else { setPublicProfile(previous => ({ ...previous, handle })); toast({ title: 'Public professional profile saved' }); }
  };

  return (
    <div className="space-y-5">

      {/* ── Photo card ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex flex-col items-center gap-4">

          {/* Tappable avatar — the whole circle is the upload target */}
          <button
            type="button"
            onClick={() => !uploading && fileInputRef.current?.click()}
            disabled={uploading}
            className="relative group rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label="Change profile photo"
          >
            {/* Avatar image */}
            <div className="h-24 w-24 rounded-full overflow-hidden ring-2 ring-border/60 ring-offset-2 ring-offset-card">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-primary/10">
                  <span className="text-3xl font-bold text-primary">{initials}</span>
                </div>
              )}
            </div>

            {/* Dark overlay + icon on hover / while uploading */}
            <div className={cn(
              "absolute inset-0 rounded-full flex flex-col items-center justify-center gap-1 transition-all duration-200",
              uploading
                ? "bg-black/50"
                : "bg-black/0 group-hover:bg-black/40 group-active:bg-black/55",
            )}>
              {uploading ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-150" />
              )}
            </div>

            {/* Small camera badge at bottom-right */}
            <div className={cn(
              "absolute bottom-0.5 right-0.5 h-7 w-7 rounded-full flex items-center justify-center shadow-md border-2 border-card transition-colors",
              uploading ? "bg-muted" : "bg-primary group-hover:bg-primary/90",
            )}>
              {uploading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                : <Camera className="h-3.5 w-3.5 text-primary-foreground" />}
            </div>
          </button>

          {/* Name + tap hint */}
          <div className="text-center">
            <p className="font-semibold text-base">
              {formData.username || user?.email?.split("@")[0] || "Your name"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-2">
              {uploading ? "Uploading…" : "Tap photo to change"}
            </p>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarUpload}
        className="hidden"
      />

      {/* ── Fields ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card divide-y divide-border/40">
        <div className="flex items-center gap-4 px-5 py-4">
          <Label htmlFor="username" className="w-16 shrink-0 text-sm text-muted-foreground">
            Name
          </Label>
          <Input
            id="username"
            value={formData.username}
            onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
            placeholder="Your display name"
            className="border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0 shadow-none"
          />
        </div>
        <div className="flex items-center gap-4 px-5 py-4">
          <Label htmlFor="email" className="w-16 shrink-0 text-sm text-muted-foreground">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            placeholder="you@example.com"
            className="border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0 shadow-none"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2 rounded-xl px-5">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">Public professional identity</h3><p className="mt-1 text-sm text-muted-foreground">Used for your published project portfolio. Your email and private project data are never shown.</p></div><Switch checked={publicProfile.is_public} onCheckedChange={is_public => setPublicProfile(previous => ({ ...previous, is_public }))} aria-label="Make professional profile public" /></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="public-handle">Handle</Label><Input id="public-handle" value={publicProfile.handle} onChange={event => setPublicProfile(previous => ({ ...previous, handle: event.target.value }))} placeholder="long-term-analyst" maxLength={40} /></div><div className="space-y-1.5"><Label htmlFor="public-name">Display name</Label><Input id="public-name" value={publicProfile.display_name} onChange={event => setPublicProfile(previous => ({ ...previous, display_name: event.target.value }))} maxLength={80} /></div></div>
        <div className="space-y-1.5"><Label htmlFor="public-bio">Professional bio</Label><Textarea id="public-bio" value={publicProfile.bio} onChange={event => setPublicProfile(previous => ({ ...previous, bio: event.target.value }))} maxLength={500} placeholder="Describe your project experience, specialties, and approach without sharing private information." /></div>
        <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Public profile: /professionals/{publicProfile.handle || 'your-handle'}</p><Button size="sm" variant="outline" onClick={savePublicProfile} disabled={publicSaving}>{publicSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Save public profile</Button></div>
      </div>
    </div>
  );
};

export default ProfileSettings;
