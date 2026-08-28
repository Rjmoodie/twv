const x = (value: unknown) => String(value ?? '').replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c] as string));
export default async function handler(_req: any, res: any) {
  const base=process.env.VITE_SUPABASE_URL; const key=process.env.VITE_SUPABASE_ANON_KEY; let posts:any[]=[];
  if (base&&key) { const response=await fetch(`${base}/rest/v1/public_research_posts?select=slug,ticker,title,summary,published_at&order=published_at.desc&limit=100`,{headers:{apikey:key,Authorization:`Bearer ${key}`}}); if(response.ok) posts=await response.json(); }
  res.setHeader('Content-Type','application/rss+xml; charset=utf-8'); res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=86400');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>SomaTech Community Research</title><link>https://somatech.pro/research</link><description>Source-aware community investment analysis.</description>${posts.map(post=>`<item><title>${x(post.ticker)}: ${x(post.title)}</title><link>https://somatech.pro/research/${x(post.slug)}</link><guid isPermaLink="true">https://somatech.pro/research/${x(post.slug)}</guid><pubDate>${new Date(post.published_at).toUTCString()}</pubDate><description>${x(post.summary)}</description></item>`).join('')}</channel></rss>`);
}
