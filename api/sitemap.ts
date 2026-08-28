export default async function handler(_req: any, res: any) {
  const base = process.env.VITE_SUPABASE_URL; const key = process.env.VITE_SUPABASE_ANON_KEY;
  let urls = ['https://somatech.pro/','https://somatech.pro/pricing','https://somatech.pro/research'];
  if (base && key) {
    const response = await fetch(`${base}/rest/v1/public_research_posts?select=slug,updated_at&order=published_at.desc&limit=1000`, { headers: { apikey:key, Authorization:`Bearer ${key}` } });
    if (response.ok) urls = urls.concat((await response.json()).map((p:any)=>`https://somatech.pro/research/${encodeURIComponent(p.slug)}`));
  }
  res.setHeader('Content-Type','application/xml; charset=utf-8'); res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=86400');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>${url}</loc></url>`).join('')}</urlset>`);
}
