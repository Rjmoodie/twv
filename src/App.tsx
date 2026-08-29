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
const ResetPasswordPage = lazyWithRetry(() => import('./pages/ResetPasswordPage'));
const AuthCallbackPage = lazyWithRetry(() => import('./pages/AuthCallbackPage'));
const InviteAcceptancePage = lazyWithRetry(() => import('./pages/InviteAcceptancePage'));

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
                            <Workspace />
                          </Suspense>
                        } 
                      />
                      <Route path="/investors" element={<Suspense fallback={<div>Loading…</div>}><InvestorInquiryPage /></Suspense>} />
                      <Route path="/investor" element={<Suspense fallback={<div>Loading investor portal…</div>}><Workspace portalIntent="investor" /></Suspense>} />
                      <Route path="/pm" element={<Suspense fallback={<div>Loading project manager portal…</div>}><Workspace portalIntent="project_manager" /></Suspense>} />
                      <Route path="/client" element={<Suspense fallback={<div>Loading client portal…</div>}><Workspace portalIntent="client" /></Suspense>} />
                      <Route path="/invite/:token" element={<Suspense fallback={<div>Loading invitation…</div>}><InviteAcceptancePage /></Suspense>} />
                      <Route 
                        path="/get-started"
                        element={
                          <Suspense fallback={<div>Loading...</div>}>
                            <ClientOnboardingPage />
                          </Suspense>
                        } 
                      />
                      <Route path="/pricing" element={<Navigate to="/get-started" replace />} />
                      <Route 
                        path="/reset-password" 
                        element={
                          <Suspense fallback={
                            <div className="flex items-center justify-center min-h-screen">
                              <div className="text-center">
                                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
                                <p className="mt-4 text-muted-foreground">Loading...</p>
                              </div>
                            </div>
                          }>
                            <ResetPasswordPage />
                          </Suspense>
                        } 
                      />
                      <Route path="/auth/callback" element={<Suspense fallback={<div>Confirming account…</div>}><AuthCallbackPage /></Suspense>} />
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
