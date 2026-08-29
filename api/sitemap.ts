type ResponseLike = { status(code: number): ResponseLike; setHeader(name: string, value: string): void; send(body: string): void };
type RequestLike = Record<string, unknown>;
const SITE_URL = 'https://twv-llc.com';
const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character]!);

export default async function handler(_request: RequestLike, response: ResponseLike) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL; const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const fixed = ['/', '/investors', '/get-started'];
  const dynamic: Array<{ path: string; updated: string }> = [];
  if (supabaseUrl && anonKey) {
    const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };
    const [profiles, stories] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/public_profiles?select=handle,updated_at&is_public=eq.true`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/pm_portfolio_entries?select=slug,updated_at&status=eq.published`, { headers }),
    ]);
    if (profiles.ok) dynamic.push(...((await profiles.json()) as Array<{ handle: string; updated_at: string }>).map((item) => ({ path: `/professionals/${item.handle}`, updated: item.updated_at })));
    if (stories.ok) dynamic.push(...((await stories.json()) as Array<{ slug: string; updated_at: string }>).map((item) => ({ path: `/work/${item.slug}`, updated: item.updated_at })));
  }
  const urls = [
    ...fixed.map((path) => ({ path, updated: new Date().toISOString() })),
    ...dynamic,
  ].map((item) => `<url><loc>${escapeXml(`${SITE_URL}${item.path}`)}</loc><lastmod>${escapeXml(item.updated.slice(0, 10))}</lastmod><changefreq>${item.path.startsWith('/work/') ? 'monthly' : 'weekly'}</changefreq></url>`).join('');
  response.setHeader('Content-Type', 'application/xml; charset=utf-8'); response.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400'); response.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
}
