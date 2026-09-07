import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BriefcaseBusiness, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicBrandHeader from '@/components/app/PublicBrandHeader';
import { Button } from '@/components/ui/button';

type DbResult = { data: unknown; error: { message: string } | null };
interface DbQuery extends PromiseLike<DbResult> {
  eq(column: string, value: unknown): DbQuery;
  order(column: string, options?: { ascending?: boolean }): DbQuery;
  single(): Promise<DbResult>;
}
const database = supabase as unknown as { from(table: string): { select(columns?: string): DbQuery } };

const SITE_URL = 'https://twv-llc.com';
type Profile = { user_id: string; handle: string; display_name: string; bio: string | null; avatar_url: string | null };
type Entry = { id: string; slug: string; title: string; project_type: string; location_public: string | null; summary: string; featured_image_url: string | null; completed_on: string | null; services: string[]; article_title: string | null; article_excerpt: string | null };

function PortfolioState({ title, copy }: { title: string; copy: string }) {
  return (
    <main className="public-page min-h-screen bg-[#f3f0e9]">
      {/* An unknown or private handle still answers 200, so this keeps the miss
          out of the index rather than letting it look like a real portfolio. */}
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
      <PublicBrandHeader section="Project Portfolio" />
      <section className="mx-auto flex min-h-[calc(100vh-89px)] max-w-3xl items-center px-5 py-16 text-center sm:px-8">
        <div className="brand-card w-full p-8 sm:p-12">
          <BriefcaseBusiness className="mx-auto h-8 w-8 text-[#9a7b4f]" />
          <h1 className="brand-serif mt-5 text-4xl text-[#071a33]">{title}</h1>
          <p className="mx-auto mt-3 max-w-lg leading-7 text-slate-600">{copy}</p>
          <Button asChild className="mt-7"><Link to="/">Return to TW Ventures</Link></Button>
        </div>
      </section>
    </main>
  );
}

function PortfolioLoading() {
  return (
    <main className="public-page min-h-screen" aria-busy="true">
      <PublicBrandHeader section="Project Portfolio" />
      <section className="brand-hero px-5 py-12 sm:px-8 sm:py-16">
        <div className="relative mx-auto max-w-7xl animate-pulse">
          <div className="h-3 w-48 rounded bg-white/15" />
          <div className="mt-6 h-12 w-full max-w-md rounded bg-white/15" />
          <div className="mt-5 h-5 w-full max-w-2xl rounded bg-white/10" />
          <div className="mt-3 h-5 w-4/5 max-w-xl rounded bg-white/10" />
        </div>
      </section>
      <section className="bg-[#f3f0e9] px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className="h-4 w-28 rounded bg-[#071a33]/10" />
          <div className="mt-5 h-10 w-full max-w-lg rounded bg-[#071a33]/10" />
          <div className="mt-8 grid gap-6 lg:grid-cols-2">{Array.from({ length: 2 }).map((_, index) => <div key={index} className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="aspect-[16/9] bg-slate-100" /><div className="h-44 space-y-4 p-6"><div className="h-3 w-32 rounded bg-slate-100" /><div className="h-7 w-4/5 rounded bg-slate-100" /><div className="h-4 w-full rounded bg-slate-100" /></div></div>)}</div>
        </div>
      </section>
      <span className="sr-only" aria-live="polite">Loading portfolio</span>
    </main>
  );
}

export default function PublicPortfolioPage() {
  const { handle = '' } = useParams();
  const page = useQuery({
    queryKey: ['public-pm-portfolio', handle],
    queryFn: async () => {
      const profileResult = await database
        .from('public_profiles')
        .select('user_id, handle, display_name, bio, avatar_url')
        .eq('handle', handle)
        .eq('is_public', true)
        .single();
      if (profileResult.error) throw profileResult.error;
      const profile = profileResult.data as Profile;
      const entriesResult = await database
        .from('pm_portfolio_entries')
        .select('id, slug, title, project_type, location_public, summary, featured_image_url, completed_on, services, article_title, article_excerpt')
        .eq('user_id', profile.user_id)
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      if (entriesResult.error) throw entriesResult.error;
      return { profile, entries: (entriesResult.data ?? []) as Entry[] };
    },
  });

  if (page.isLoading) {
    return <PortfolioLoading />;
  }
  if (page.error || !page.data) {
    return <PortfolioState title="Portfolio not found" copy="This professional portfolio is unavailable or private." />;
  }

  const { profile, entries } = page.data;
  const canonical = `${SITE_URL}/professionals/${profile.handle}`;
  const description = profile.bio || `Explore ${profile.display_name}'s completed real estate and construction projects.`;
  // Share the newest project photo rather than the generic site card — the work
  // is the reason to click, and this page always has some.
  const shareImage = entries.find((entry) => entry.featured_image_url)?.featured_image_url ?? `${SITE_URL}/og-image.jpg`;

  return (
    <main className="public-page min-h-screen">
      <Helmet>
        <title>{profile.display_name} — Project Portfolio | TW Ventures</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={`${profile.display_name} — Project Portfolio`} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="profile" />
        <meta property="og:image" content={shareImage} />
        <meta name="twitter:image" content={shareImage} />
      </Helmet>

      <PublicBrandHeader
        section="Project Portfolio"
        actions={(
          <>
            <Button asChild variant="ghost" className="gap-2 text-[#071a33]"><Link to="/"><ArrowLeft className="h-4 w-4" /><span className="brand-nav-label">Our approach</span></Link></Button>
            <Button asChild className="gap-2"><Link to="/get-started"><span className="brand-nav-label">Discuss a project</span><ArrowRight className="h-4 w-4" /></Link></Button>
          </>
        )}
      />

      <section className="brand-hero px-5 py-12 sm:px-8 sm:py-16">
        <div className="relative mx-auto flex max-w-7xl flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex max-w-4xl flex-col gap-6 sm:flex-row sm:items-center">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover ring-1 ring-white/20" />
            ) : (
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/10">
                <BriefcaseBusiness className="h-7 w-7 text-[#dfc48e]" />
              </div>
            )}
            <div>
              <p className="brand-kicker !text-[#dfc48e]">TW Ventures project portfolio</p>
              <h1 className="brand-serif mt-3 text-4xl leading-tight sm:text-6xl">{profile.display_name}</h1>
              {profile.bio && <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">{profile.bio}</p>}
            </div>
          </div>
          <div className="flex shrink-0 gap-7 border-t border-white/15 pt-5 sm:border-l sm:border-t-0 sm:pl-7 sm:pt-0">
            <div><p className="text-2xl font-semibold tabular-nums">{entries.length}</p><p className="mt-1 text-xs uppercase tracking-[.16em] text-slate-400">Published {entries.length === 1 ? 'project' : 'projects'}</p></div>
            <div><p className="text-2xl font-semibold">PA</p><p className="mt-1 text-xs uppercase tracking-[.16em] text-slate-400">Philadelphia</p></div>
          </div>
        </div>
      </section>

      <section className="bg-[#f3f0e9] px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-3xl">
            <p className="brand-kicker !text-[#9a7b4f]">Selected work</p>
            <h2 className="brand-serif mt-3 text-4xl text-[#071a33] sm:text-5xl">Projects delivered with intention.</h2>
            <p className="mt-3 leading-7 text-slate-600">Open a project for its scope, completed work, outcomes, and photography.</p>
          </div>

          {entries.length ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {entries.map((entry) => (
                <Link key={entry.id} to={`/work/${entry.slug}`} className="brand-card group overflow-hidden bg-white transition duration-200 hover:-translate-y-1 hover:border-[#9a7b4f]/55 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7b4f]">
                  {entry.featured_image_url ? (
                    <img src={entry.featured_image_url} alt={`${entry.title} project`} loading="lazy" className="aspect-[16/9] w-full object-cover" />
                  ) : (
                    <div className="grid aspect-[16/9] place-items-center bg-[#071a33]"><BriefcaseBusiness className="h-8 w-8 text-[#dfc48e]" /></div>
                  )}
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[.15em] text-[#9a7b4f]">
                      <span>{entry.project_type}</span>
                      {entry.completed_on && <><span aria-hidden="true">·</span><span>{new Date(`${entry.completed_on}T12:00:00`).getFullYear()}</span></>}
                    </div>
                    <h3 className="brand-serif mt-3 text-2xl leading-tight text-[#071a33] sm:text-3xl">{entry.article_title || entry.title}</h3>
                    {entry.location_public && <p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><MapPin className="h-4 w-4 shrink-0" />{entry.location_public}</p>}
                    <p className="mt-4 line-clamp-2 leading-7 text-slate-600">{entry.article_excerpt || entry.summary}</p>
                    <span className="mt-5 inline-flex items-center text-sm font-semibold text-[#071a33]">View case study <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="brand-card bg-white p-10 text-center text-slate-600">Published work will appear here.</div>
          )}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white px-5 py-12 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div><p className="brand-serif text-3xl text-[#071a33]">Planning a renovation or development?</p><p className="mt-2 text-slate-600">Start with the asset, scope, timing, and delivery model.</p></div>
          <Button asChild size="lg" className="gap-2"><Link to="/get-started">Discuss your project <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      </section>
    </main>
  );
}
