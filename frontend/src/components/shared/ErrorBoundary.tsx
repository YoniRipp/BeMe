import { Component, ErrorInfo, ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { clientLogger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorRef: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorRef: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorRef: `ERR-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Auto-reload once on stale chunk errors (happens after deployments)
    const isChunkError =
      error.message.includes('dynamically imported module') ||
      error.message.includes('Failed to fetch') ||
      error.name === 'ChunkLoadError';

    if (isChunkError && !sessionStorage.getItem('chunk_reload')) {
      sessionStorage.setItem('chunk_reload', '1');
      window.location.reload();
      return;
    }
    // Clear the flag so future deploys can trigger reload again
    sessionStorage.removeItem('chunk_reload');

    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    clientLogger.error('React ErrorBoundary caught error', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorRef: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-2xl w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Something went wrong</h1>
                <p className="text-sm text-muted-foreground">
                  We encountered an unexpected error. If this persists, contact support with reference: {this.state.errorRef ?? 'N/A'}
                </p>
              </div>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <div className="mb-4 p-4 bg-muted rounded-lg">
                <p className="text-sm font-semibold mb-2">Error Details:</p>
                <pre className="text-xs overflow-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={this.handleReset} variant="default">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={this.handleReload} variant="outline">
                Reload Page
              </Button>
              <Button onClick={this.handleGoHome} variant="outline">
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </div>

            {import.meta.env.DEV && (
              <div className="mt-4 p-3 bg-warning/10 rounded-lg border border-warning/30">
                <p className="text-xs text-warning">
                  <strong>Development Mode:</strong> Error details are shown above. 
                  In production, users will only see the error message.
                </p>
              </div>
            )}
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
