"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Class component error boundary — catches runtime errors in any child component.
 * Wrap routes and large feature sections with this.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // In production, forward to Sentry or similar:
    // Sentry.captureException(error, { extra: info });
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
          <AlertTriangle
            className="h-10 w-10 text-destructive"
            aria-hidden
          />
          <div className="space-y-1">
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
