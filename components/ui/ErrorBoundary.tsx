'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Report to Sentry if available
    import('@sentry/nextjs')
      .then((Sentry) => {
        Sentry.captureException(error, {
          contexts: { react: { componentStack: errorInfo.componentStack ?? undefined } },
        });
      })
      .catch(() => {});
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertCircle className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {this.props.fallbackMessage ?? 'Something went wrong'}
          </p>
          <p className="text-xs text-muted-foreground max-w-sm">
            This section encountered an error. You can try again or refresh the page.
          </p>
          <Button variant="outline" size="sm" onClick={this.handleRetry}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
