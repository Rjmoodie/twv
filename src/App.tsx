import { Suspense } from 'react';
import { useNativeApp } from '@/hooks/useNativeApp';
import { useStatusBarTheme } from '@/hooks/useStatusBarTheme';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import ErrorBoundary from '@/components/app/ErrorBoundary';
import PerformanceProvider from '@/components/app/PerformanceProvider';
import ErrorProvider from '@/components/app/ErrorProvider';
import AuthProvider, { useAuth } from '@/components/app/AuthProvider';
import SessionTimeoutWarning from '@/components/app/SessionTimeoutWarning';
import { CookieConsent } from '@/components/app/CookieConsent';
import { setAnalyticsSink } from '@/lib/analytics';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import RouteSeo from '@/components/app/RouteSeo';
import PortalRouteGuard from '@/components/app/PortalRouteGuard';

// ─── Analytics sink ───────────────────────────────────────────────────────────
//
// Call sites throughout the app emit typed events via `track()`. They are
// no-ops until a sink is installed here. In development the sink echoes to the
// console so instrumentation is verifiable without a vendor account.
//
// To ship: replace the body with your provider, e.g.
//   setAnalyticsSink((event, props) => posthog.capture(event, props))
// Note the CookieConsent gate below — do not install a network sink for a
// visitor who has not consented to analytics cookies.
if (import.meta.env.DEV) {
  setAnalyticsSink((event, props) => {
     
    console.debug('[analytics]', event, props);
  });
}

// Lazy load main pages
const Workspace = lazyWithRetry(() => import('./pages/Workspace'));
const InvestorInquiryPage = lazyWithRetry(() => import('./pages/InvestorInquiryPage'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));
const ClientOnboardingPage = lazyWithRetry(() => import('./pages/ClientOnboardingPage'));
const ProjectIntakePage = lazyWithRetry(() => import('./pages/ProjectIntakePage'));
const AuthCallbackPage = lazyWithRetry(() => import('./pages/AuthCallbackPage'));
const InviteAcceptancePage = lazyWithRetry(() => import('./pages/InviteAcceptancePage'));
const PublicPortfolioPage = lazyWithRetry(() => import('./pages/PublicPortfolioPage'));
const PortfolioStoryPage = lazyWithRetry(() => import('./pages/PortfolioStoryPage'));
// Legal pages are Workspace modules too, but they need addressable URLs of their
// own: Google's OAuth consent screen validates the privacy and terms links, and
// `?module=privacy-policy` renders them inside the signed-in app chrome.
const PrivacyPolicy = lazyWithRetry(() => import('./components/app/PrivacyPolicy'));
const TermsOfService = lazyWithRetry(() => import('./components/app/TermsOfService'));

// Create a new QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Renders session-timeout warning only when a user is signed in. */
function SessionGuard() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  return <SessionTimeoutWarning onSignOut={signOut} />;
}

function NativeAppInit() {
  useNativeApp();
  useStatusBarTheme();
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <PerformanceProvider>
          <ErrorProvider>
            <AuthProvider>
              <NativeAppInit />
              <TooltipProvider>
                <BrowserRouter>
                  <RouteSeo />
                  <div className="min-h-screen bg-background">
                    <Routes>
                      <Route 
                        path="/" 
                        element={
                          <Suspense fallback={
                            <div className="flex items-center justify-center min-h-screen">
                              <div className="text-center">
                                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
                                <p className="mt-4 text-muted-foreground">Loading TW Ventures...</p>
                              </div>
                            </div>
                          }>
                            <ClientOnboardingPage />
                          </Suspense>
                        } 
                      />
                      <Route path="/investors" element={<Suspense fallback={<div>Loading…</div>}><InvestorInquiryPage /></Suspense>} />
                      <Route path="/investor" element={<PortalRouteGuard intent="investor"><Suspense fallback={<div>Loading investor portal…</div>}><Workspace portalIntent="investor" /></Suspense></PortalRouteGuard>} />
                      <Route path="/pm" element={<PortalRouteGuard intent="project_manager"><Suspense fallback={<div>Loading project manager portal…</div>}><Workspace portalIntent="project_manager" /></Suspense></PortalRouteGuard>} />
                      <Route path="/client" element={<PortalRouteGuard intent="client"><Suspense fallback={<div>Loading client portal…</div>}><Workspace portalIntent="client" /></Suspense></PortalRouteGuard>} />
                      <Route path="/invite/:token" element={<Suspense fallback={<div>Loading invitation…</div>}><InviteAcceptancePage /></Suspense>} />
                      <Route path="/professionals/:handle" element={<Suspense fallback={<div>Loading portfolio…</div>}><PublicPortfolioPage /></Suspense>} />
                      <Route path="/work/:slug" element={<Suspense fallback={<div>Loading case study…</div>}><PortfolioStoryPage /></Suspense>} />
                      <Route 
                        path="/get-started"
                        element={
                          <Suspense fallback={<div>Loading...</div>}>
                            <ProjectIntakePage />
                          </Suspense>
                        } 
                      />
                      <Route path="/pricing" element={<Navigate to="/get-started" replace />} />
                      <Route path="/auth/callback" element={<Suspense fallback={<div>Confirming account…</div>}><AuthCallbackPage /></Suspense>} />
                      <Route path="/privacy-policy" element={<Suspense fallback={<div>Loading…</div>}><PrivacyPolicy /></Suspense>} />
                      <Route path="/terms-of-service" element={<Suspense fallback={<div>Loading…</div>}><TermsOfService /></Suspense>} />
                      <Route 
                        path="/404" 
                        element={
                          <Suspense fallback={<div>Loading...</div>}>
                            <NotFound />
                          </Suspense>
                        } 
                      />
                      <Route path="*" element={<Navigate to="/404" replace />} />
                    </Routes>
                  <SessionGuard />
                  </div>
                </BrowserRouter>
                <Toaster />
                <Sonner />
                <CookieConsent />
              </TooltipProvider>
            </AuthProvider>
          </ErrorProvider>
        </PerformanceProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
