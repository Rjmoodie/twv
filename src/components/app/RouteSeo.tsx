import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SITE_URL = 'https://twv-llc.com';

const routeMetadata: Record<string, { title: string; description: string; index: boolean }> = {
  '/': {
    title: 'Philadelphia Real Estate Investment & Development | TW Ventures',
    description: 'TW Ventures partners with investors to acquire, develop, build, and manage Philadelphia real estate through one accountable platform.',
    index: true,
  },
  '/investors': {
    title: 'Invest in Philadelphia Real Estate | TW Ventures',
    description: 'TW Ventures acquires, develops, and builds Philadelphia real estate in-house. Start a conversation about investing alongside us.',
    index: true,
  },
  '/get-started': {
    title: 'Start a Real Estate or Construction Project | TW Ventures',
    description: 'Tell TW Ventures about your acquisition, development, construction, renovation, or property-management project.',
    index: true,
  },
  '/reset-password': {
    title: 'Reset Password | TW Ventures',
    description: 'Securely reset your TW Ventures account password.',
    index: false,
  },
  '/auth/callback': {
    title: 'Confirming Account | TW Ventures',
    description: 'Confirming your TW Ventures account.',
    index: false,
  },
  '/404': {
    title: 'Page Not Found | TW Ventures',
    description: 'The requested page could not be found.',
    index: false,
  },
};

/**
 * Routes matched by prefix rather than exact path.
 *
 * Two reasons this exists. `/invite/:token` carries a token, so it can never be
 * an exact key. And without an entry, every portal route fell through to the
 * `/404` metadata — correctly noindexed, but titling a signed-in investor's
 * page "Page Not Found" in their tab, their history, and any bookmark.
 *
 * All of these are `index: false`, which also forces the canonical to `/` — so
 * no invite token reaches a canonical, an og:url, or a link preview.
 */
const prefixRoutes: [string, (typeof routeMetadata)[string]][] = [
  ['/privacy-policy',   { title: 'Privacy Policy | TW Ventures', description: 'How TW Ventures collects, uses, and protects your information.', index: true }],
  ['/terms-of-service', { title: 'Terms of Service | TW Ventures', description: 'The terms governing use of the TW Ventures platform.', index: true }],
  ['/professionals', { title: 'Project Manager Portfolio | TW Ventures', description: 'Meet the professionals delivering TW Ventures real estate and construction projects.', index: true }],
  ['/work', { title: 'Real Estate Project Case Study | TW Ventures', description: 'Explore completed real estate and construction work delivered by TW Ventures professionals.', index: true }],
  ['/investor', { title: 'Investor Portal | TW Ventures', description: 'Your commitments, distributions, and project updates.', index: false }],
  ['/pm',       { title: 'Project Manager | TW Ventures', description: 'Assigned projects, schedule, and job cost.', index: false }],
  ['/client',   { title: 'Client Portal | TW Ventures', description: 'Your project schedule, draws, invoices, and documents.', index: false }],
  ['/invite',   { title: 'Accept Invitation | TW Ventures', description: 'Accept your invitation to TW Ventures.', index: false }],
];

export default function RouteSeo() {
  const { pathname } = useLocation();
  const metadata =
    routeMetadata[pathname] ??
    prefixRoutes.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ??
    routeMetadata['/404'];
  const canonicalPath = metadata.index ? pathname : '/';
  const canonical = `${SITE_URL}${canonicalPath === '/' ? '/' : canonicalPath}`;

  return (
    <Helmet>
      <title>{metadata.title}</title>
      <meta name="description" content={metadata.description} />
      <meta
        name="robots"
        content={metadata.index
          ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
          : 'noindex, nofollow'}
      />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={metadata.title} />
      <meta property="og:description" content={metadata.description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={`${SITE_URL}/og-image.jpg`} />
      <meta property="og:image:type" content="image/jpeg" />
      <meta property="og:image:width" content="1536" />
      <meta property="og:image:height" content="1024" />
      <meta property="og:image:alt" content="TW Ventures — Acquire, Build, Manage" />
      {/* Restated per route: Helmet only overrides tags it renders, and the
          static card type in index.html would otherwise win. */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={metadata.title} />
      <meta name="twitter:description" content={metadata.description} />
      <meta name="twitter:image" content={`${SITE_URL}/og-image.jpg`} />
    </Helmet>
  );
}
