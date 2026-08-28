const e = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c] as string));
export default async function handler(req: any, res: any) {
  const base = process.env.VITE_SUPABASE_URL; const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) return res.status(503).send('Research is temporarily unavailable');
  const headers = { apikey:key, Authorization:`Bearer ${key}` };
  let heading = 'Community Investment Research'; let description = 'Independent, source-aware analysis with explicit risks and disclosures.'; let filter = '';
  if (req.query.ticker) {
    const ticker = String(req.query.ticker).toUpperCase(); if (!/^[A-Z0-9.-]{1,12}$/.test(ticker)) return res.status(404).send('Not found');
    heading = `${ticker} community research`; description = `Published SomaTech community analysis for ${ticker}.`; filter = `&ticker=eq.${encodeURIComponent(ticker)}`;
  } else if (req.query.handle) {
    const handle = String(req.query.handle).toLowerCase(); if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(handle)) return res.status(404).send('Not found');
    const profileResult = await fetch(`${base}/rest/v1/public_profiles?handle=eq.${encodeURIComponent(handle)}&is_public=eq.true&select=handle,display_name,bio&limit=1`, { headers });
    const [profile] = profileResult.ok ? await profileResult.json() : [];
    if (!profile) return res.status(404).send('Author not found');
    heading = `${profile.display_name} — research`; description = profile.bio || `Published investment research by ${profile.display_name}.`; filter = `&author_handle=eq.${encodeURIComponent(handle)}`;
  }
  const response = await fetch(`${base}/rest/v1/public_research_posts?${filter.replace(/^&/, '')}${filter ? '&' : ''}select=slug,ticker,company_name,title,summary,published_at&order=published_at.desc&limit=100`, { headers });
  if (!response.ok) return res.status(503).send('Research is temporarily unavailable'); const posts = await response.json();
  const canonical = req.query.ticker ? `https://somatech.pro/stocks/${encodeURIComponent(String(req.query.ticker).toUpperCase())}` : `https://somatech.pro/authors/${encodeURIComponent(String(req.query.handle))}`;
  res.setHeader('Content-Type','text/html; charset=utf-8'); res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=86400');
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(heading)} | SomaTech</title><meta name="description" content="${e(description)}"><link rel="canonical" href="${canonical}"><meta name="robots" content="index,follow"><style>body{margin:0;background:#f7f8fb;color:#161923;font:16px/1.6 Inter,system-ui}main{max-width:850px;margin:auto;padding:48px 20px}a{color:inherit;text-decoration:none}.brand,.ticker{color:#2463eb;font-weight:700}.card{display:block;background:white;border:1px solid #dde2ea;border-radius:16px;padding:22px;margin:16px 0}.card:hover{border-color:#2463eb}h1{font-size:42px;line-height:1.1}.summary{color:#596174}</style></head><body><main><a class="brand" href="/research">SomaTech Research</a><h1>${e(heading)}</h1><p>${e(description)}</p>${posts.length ? posts.map((p:any)=>`<a class="card" href="/research/${e(p.slug)}"><span class="ticker">${e(p.ticker)} · ${e(p.company_name)}</span><h2>${e(p.title)}</h2><p class="summary">${e(p.summary)}</p></a>`).join('') : '<div class="card">No published research yet.</div>'}</main></body></html>`);
}
