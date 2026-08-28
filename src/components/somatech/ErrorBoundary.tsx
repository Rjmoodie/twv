import React from 'react';
import { Button } from '@/components/ui/button';
import { isChunkLoadError } from '@/lib/lazyWithRetry';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Called after the user clicks "Try again" — use to reset parent state if needed */
  onReset?: () => void;
  /** Compact inline error UI instead of full-height centred panel */
  inline?: boolean;
  /** What failed, for the inline message. Defaults to "this module". */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  online: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: null,
      online: typeof navigator === 'undefined' ? true : navigator.onLine,
    };
  }

  componentDidMount() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log in every environment. Suppressing this in production meant a crash
    // reached the user as "an unexpected error occurred" and reached us as
    // nothing at all — there was no way to tell a stale chunk from a null
    // dereference without reproducing it locally, which for a signed-in,
    // data-dependent screen is often not possible.
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ componentStack: errorInfo.componentStack ?? null });
  }

  /** The failure in a form the user can paste to us. */
  private errorReport(): string {
    const { error, componentStack } = this.state;
    return [
      `Error: ${error?.name ?? 'Unknown'}: ${error?.message ?? 'no message'}`,
      `Path: ${typeof window !== 'undefined' ? window.location.pathname + window.location.search : 'unknown'}`,
      `Build: ${import.meta.env.MODE}`,
      error?.stack ? `\nStack:\n${error.stack}` : '',
      componentStack ? `\nComponent stack:${componentStack}` : '',
    ].filter(Boolean).join('\n');
  }

  handleOnline = () => {
    this.setState({ online: true });
    if (this.state.hasError && isChunkLoadError(this.state.error)) {
      window.location.reload();
    }
  };

  handleOffline = () => this.setState({ online: false });

  handleReset = () => {
    if (isChunkLoadError(this.state.error)) {
      if (!this.state.online) return;
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null, componentStack: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.inline) {
        return (
          <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span>Couldn't load {this.props.label ?? 'this module'}.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              disabled={isChunkLoadError(this.state.error) && !this.state.online}
            >
              {isChunkLoadError(this.state.error)
                ? (this.state.online ? 'Reload latest version' : 'Reconnect to retry')
                : 'Try again'}
            </Button>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
          <h2 className="text-xl font-semibold text-destructive mb-2">
            Failed to load module
          </h2>
          <p className="text-muted-foreground mb-4 max-w-sm">
            An unexpected error occurred while loading this section.
            {this.state.error && (
              <span className="mt-2 block font-mono text-xs text-destructive">
                {this.state.error.message}
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              onClick={this.handleReset}
              disabled={isChunkLoadError(this.state.error) && !this.state.online}
            >
              {isChunkLoadError(this.state.error)
                ? (this.state.online ? 'Reload latest version' : 'Reconnect to retry')
                : 'Try again'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(this.errorReport());
              }}
            >
              Copy error details
            </Button>
          </div>
          {this.state.componentStack && (
            <details className="mt-4 max-w-xl text-left">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Technical details
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted/40 p-3 text-left font-mono text-[10px] leading-relaxed text-muted-foreground">
                {this.errorReport()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
