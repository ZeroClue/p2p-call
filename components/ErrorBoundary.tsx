import React, { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);

    // Log error to external service here (e.g., Sentry)
    // Example: Sentry.captureException(error, { extra: errorInfo });

    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-950 text-slate-200 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-red-900/20 border border-red-500/50 rounded-lg p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-red-400 mb-2">Something went wrong</h1>
              <p className="text-gray-300 mb-6">
                We encountered an unexpected error. This has been logged and we'll look into it.
              </p>
            </div>

            {this.state.error && (
              <details className="mb-6 bg-gray-900/50 rounded-lg p-4">
                <summary className="cursor-pointer text-gray-400 hover:text-gray-300 font-medium mb-2">
                  Error Details
                </summary>
                <div className="mt-4 space-y-2">
                  <div>
                    <span className="text-red-400 font-semibold">Error:</span>
                    <pre className="mt-1 text-sm text-gray-300 overflow-auto p-2 bg-gray-950 rounded">
                      {this.state.error.toString()}
                    </pre>
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <span className="text-red-400 font-semibold">Stack Trace:</span>
                      <pre className="mt-1 text-xs text-gray-400 overflow-auto p-2 bg-gray-950 rounded max-h-64">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-4 justify-center">
              <button
                onClick={this.handleGoHome}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition"
              >
                Go to Home
              </button>
              <button
                onClick={this.handleReload}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
