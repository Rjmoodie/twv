import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PublicBrandHeader from '@/components/app/PublicBrandHeader';
import type { GalleryPhoto } from '@/components/app/portfolio/types';

type DbResult = { data: unknown; error: { message: string } | null };
interface DbQuery extends PromiseLike<DbResult> {
  eq(column: string, value: unknown): DbQuery;
  single(): Promise<DbResult>;
}
const database = supabase as unknown as { from(table: string): { select(columns?: string): DbQuery } };

const SITE_URL = 'https://twv-llc.com';
type Story = { user_id: string; slug: string; title: string; project_type: string; location_public: string | null; completed_on: string | null; summary: string; challenge: string | null; work_completed: string; outcomes: string | null; services: string[]; featured_image_url: string | null; gallery: GalleryPhoto[] | null; latitude: number | null; longitude: number | null; article_title: string | null; article_excerpt: string | null; article_body: string | null; seo_title: string | null; seo_description: string | null; published_at: string };
type Author = { handle: string; display_name: string; bio: string | null; avatar_url: string | null };

function StoryState({ title, copy }: { title: string; copy: string }) {
  return (
    <main className="public-page min-h-screen bg-[#f3f0e9]">
      <PublicBrandHeader section="Project Case Study" />
      <section className="mx-auto flex min-h-[calc(100vh-89px)] max-w-3xl items-center px-5 py-16 text-center sm:px-8">
        <div className="brand-card w-full p-8 sm:p-12">
          <h1 className="brand-serif text-4xl text-[#071a33]">{title}</h1>
          <p className="mx-auto mt-3 max-w-lg leading-7 text-slate-600">{copy}</p>
          <Button asChild className="mt-7"><Link to="/">Return to TW Ventures</Link></Button>
        </div>
      </section>
    </main>
  );
}

export default function PortfolioStoryPage() {
  const { slug = '' } = useParams();
  const page = useQuery({
    queryKey: ['public-portfolio-story', slug],
    queryFn: async () => {
      const entryResult = await database.from('pm_portfolio_entries').select('*').eq('slug', slug).eq('status', 'published').single();
      if (entryResult.error) throw entryResult.error;
      const entry = entryResult.data as Story;
      const authorResult = await database.from('public_profiles').select('handle, display_name, bio, avatar_url').eq('user_id', entry.user_id).eq('is_public', true).single();
      if (authorResult.error) throw authorResult.error;
      return { entry, author: authorResult.data as Author };
    },
  });

  if (page.isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f3f0e9] text-[#071a33]">Loading case study…</div>;
  }
  if (page.error || !page.data) {
    return <StoryState title="Case study not found" copy="This story is unavailable or has not been published." />;
  }

  const { entry, author } = page.data;
  const title = entry.seo_title || entry.article_title || entry.title;
  const description = entry.seo_description || entry.article_excerpt || entry.summary;
  const canonical = `${SITE_URL}/work/${entry.slug}`;
  const paragraphs = (entry.article_body || entry.work_completed).split(/\n{2,}/).filter(Boolean);
  const gallery = Array.isArray(entry.gallery) ? entry.gallery : [];
  const images = [entry.featured_image_url, ...gallery.map((photo) => photo.url)].filter((url): url is string => !!url);
  const completedYear = entry.completed_on ? new Date(`${entry.completed_on}T12:00:00`).getFullYear() : null;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: entry.article_title || entry.title,
    description,
    image: images.length ? Array.from(new Set(images)) : undefined,
    datePublished: entry.published_at,
    author: { '@type': 'Person', name: author.display_name, url: `${SITE_URL}/professionals/${author.handle}` },
    publisher: { '@type': 'Organization', name: 'TW Ventures', url: SITE_URL },
    contentLocation: entry.location_public ? {
      '@type': 'Place',
      name: entry.location_public,
      ...(entry.latitude != null && entry.longitude != null ? { geo: { '@type': 'GeoCoordinates', latitude: entry.latitude, longitude: entry.longitude } } : {}),
    } : undefined,
  };

  return (
    <main className="public-page min-h-screen">
      <Helmet>
        <title>{title} | TW Ventures</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        {entry.featured_image_url && <meta property="og:image" content={entry.featured_image_url} />}
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </Helmet>

      <PublicBrandHeader
        section="Project Case Study"
        actions={(
          <>
            <Button asChild variant="ghost" className="gap-2 text-[#071a33]"><Link to={`/professionals/${author.handle}`}><ArrowLeft className="h-4 w-4" /><span className="brand-nav-label">All projects</span></Link></Button>
            <Button asChild className="gap-2"><Link to="/get-started"><span className="brand-nav-label">Discuss a project</span><ArrowRight className="h-4 w-4" /></Link></Button>
          </>
        )}
      />

      <article>
        <header className="brand-hero px-5 py-12 sm:px-8 sm:py-16">
          <div className="relative mx-auto max-w-5xl">
            <Link to={`/professionals/${author.handle}`} className="inline-flex items-center text-sm font-semibold text-[#dfc48e] hover:text-white"><ArrowLeft className="mr-2 h-4 w-4" />{author.display_name} portfolio</Link>
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge className="border border-[#dfc48e]/35 bg-[#dfc48e]/15 text-[#f4e6c8]">{entry.project_type}</Badge>
              {entry.services.map((service) => <Badge key={service} className="border border-white/15 bg-white/10 text-white">{service}</Badge>)}
            </div>
            <h1 className="brand-serif mt-5 max-w-4xl text-4xl leading-[1.04] sm:text-6xl">{entry.article_title || entry.title}</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">{entry.article_excerpt || entry.summary}</p>
            {(entry.location_public || completedYear) && <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-400">{entry.location_public && <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />{entry.location_public}</span>}{completedYear && <span>Completed {completedYear}</span>}</div>}
          </div>
        </header>

        {entry.featured_image_url && <div className="bg-[#061426] px-5 pb-8 sm:px-8 sm:pb-12"><img src={entry.featured_image_url} alt={entry.title} className="mx-auto max-h-[70vh] w-full max-w-7xl rounded-lg object-contain" /></div>}

        <div className="bg-[#fbfaf7] px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-3xl">
            {entry.challenge && <section className="mb-10 border-l-2 border-[#9a7b4f] pl-5"><p className="brand-kicker !text-[#9a7b4f]">Project brief</p><p className="mt-3 text-lg leading-8 text-slate-700">{entry.challenge}</p></section>}
            <div className="space-y-6 text-lg leading-8 text-slate-700">{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>

            {entry.outcomes && <aside className="brand-card mt-10 bg-[#f3f0e9] p-6 sm:p-8"><p className="brand-kicker !text-[#9a7b4f]">Project outcome</p><p className="mt-3 text-lg leading-8 text-slate-700">{entry.outcomes}</p></aside>}

            {gallery.length > 0 && <section className="mt-12"><h2 className="brand-serif text-3xl text-[#071a33]">Project photos</h2><div className="mt-6 sm:columns-2 sm:gap-5">{gallery.map((photo) => <figure key={photo.url} className="mb-5 break-inside-avoid"><img src={photo.url} alt={photo.alt || photo.caption || entry.title} loading="lazy" className="w-full rounded-lg" />{photo.caption && <figcaption className="mt-2 text-sm leading-6 text-slate-500">{photo.caption}</figcaption>}</figure>)}</div></section>}

            <div className="mt-12 flex flex-col gap-5 border-t border-slate-200 pt-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">{author.avatar_url && <img src={author.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />}<div><p className="font-semibold text-[#071a33]">{author.display_name}</p>{author.bio && <p className="mt-1 line-clamp-1 text-sm text-slate-500">{author.bio}</p>}</div></div>
              <Button asChild variant="outline" className="gap-2"><Link to={`/professionals/${author.handle}`}>View all projects <ArrowRight className="h-4 w-4" /></Link></Button>
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
