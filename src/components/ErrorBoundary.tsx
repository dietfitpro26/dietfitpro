import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] React render catch", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-2xl space-y-4 rounded-lg border border-destructive/30 bg-card p-6 text-card-foreground shadow-sm">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-destructive">
                Erreur React capturée
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Une erreur a interrompu le rendu initial de l'application.
              </p>
            </div>
            <pre className="max-h-72 overflow-auto rounded-md bg-muted p-4 text-xs text-muted-foreground">
              {this.state.error.stack ?? this.state.error.message}
              {this.state.errorInfo?.componentStack ?? ""}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}