const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[char] as string));

const jsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

export default async function handler(req: any, res: any) {
  const slug = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug;
  if (!slug || !/^[a-z0-9-]{5,120}$/.test(slug)) return res.status(404).send('Not found');
  const base = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) return res.status(503).send('Research is temporarily unavailable');

  const response = await fetch(`${base}/rest/v1/public_research_posts?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) return res.status(503).send('Research is temporarily unavailable');
  const [post] = await response.json();
  if (!post) return res.status(404).send('Analysis not found');

  let author = 'SomaTech member';
  if (post.author_mode === 'named' && post.author_display_name) author = post.author_display_name;

  const canonical = `https://somatech.pro/research/${post.slug}`;
  const description = escapeHtml(post.summary);
  const title = escapeHtml(post.title);
  const published = post.published_at || post.created_at;
  const sources = Array.isArray(post.sources) ? post.sources : [];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  res.status(200).send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | SomaTech Research</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:type" content="article"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}"><meta property="og:site_name" content="SomaTech"><meta name="twitter:card" content="summary"><script type="application/ld+json">${jsonLd({ '@context': 'https://schema.org', '@type': 'Article', headline: post.title, description: post.summary, datePublished: published, dateModified: post.updated_at, author: { '@type': 'Person', name: author }, publisher: { '@type': 'Organization', name: 'SomaTech', url: 'https://somatech.pro' }, mainEntityOfPage: canonical, about: { '@type': 'Corporation', tickerSymbol: post.ticker, name: post.company_name } })}</script><style>body{margin:0;background:#f7f8fb;color:#161923;font:16px/1.65 Inter,system-ui,sans-serif}main{max-width:780px;margin:auto;padding:48px 20px 80px}a{color:#2463eb}header{border-bottom:1px solid #dde2ea;padding-bottom:24px}.eyebrow{color:#2463eb;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:12px}h1{font-size:clamp(32px,6vw,54px);line-height:1.08;margin:12px 0}.lede{font-size:20px;color:#596174}.meta{font-size:14px;color:#71798a}.card{background:white;border:1px solid #dde2ea;border-radius:16px;padding:24px;margin-top:24px}h2{line-height:1.2;margin-top:32px}pre{white-space:pre-wrap;font:inherit}.disclosure{background:#fff8e6;border-color:#f0d58a}.sources li{margin:.5rem 0}footer{margin-top:40px;color:#71798a;font-size:13px}</style></head><body><main><a href="https://somatech.pro/research">← SomaTech Research</a><header><p class="eyebrow">${escapeHtml(post.ticker)} · Community research</p><h1>${title}</h1><p class="lede">${description}</p><p class="meta">By ${escapeHtml(author)} · Published ${escapeHtml(new Date(published).toLocaleDateString('en-US', { dateStyle: 'long' }))} · Data snapshot ${escapeHtml(post.snapshot?.analyzedAt || 'date disclosed in sources')}</p></header><section class="card"><h2>Investment thesis</h2><pre>${escapeHtml(post.thesis)}</pre><h2>Risks and disconfirming evidence</h2><pre>${escapeHtml(post.risks)}</pre>${post.opportunities ? `<h2>Catalysts and opportunities</h2><pre>${escapeHtml(post.opportunities)}</pre>` : ''}</section><section class="card disclosure"><h2>Disclosure</h2><p>${escapeHtml(post.disclosure)}</p><p>Educational community research only. Not individualized investment advice or a guarantee of results.</p></section>${sources.length ? `<section class="card sources"><h2>Sources</h2><ul>${sources.map((source: any) => `<li>${escapeHtml(source.provider || 'Source')} ${escapeHtml(source.asOf || source.fetchedAt || '')}</li>`).join('')}</ul></section>` : ''}<footer>Analysis reflects the author's views and a point-in-time data snapshot. Verify current filings, prices, suitability, taxes, and fees before making decisions.</footer></main></body></html>`);
}
