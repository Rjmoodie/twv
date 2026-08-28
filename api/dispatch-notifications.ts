export default async function handler(req: any, res: any) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });
  const url = process.env.VITE_SUPABASE_URL; const anon = process.env.VITE_SUPABASE_ANON_KEY; const secret = process.env.NOTIFICATION_DISPATCH_SECRET;
  if (!url || !anon || !secret) return res.status(503).json({ error: 'Dispatcher configuration unavailable' });
  const response = await fetch(`${url}/functions/v1/dispatch-notifications`, { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json', 'x-dispatch-secret': secret }, body: '{}' });
  res.status(response.status).send(await response.text());
}
