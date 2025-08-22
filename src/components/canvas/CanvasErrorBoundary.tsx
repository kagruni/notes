import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class CanvasErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.error('[CanvasErrorBoundary] Caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[CanvasErrorBoundary] Error details:', {
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md">
            <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
              Canvas Error
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Something went wrong while loading the canvas.
            </p>
            <details className="text-sm text-gray-500 dark:text-gray-500">
              <summary className="cursor-pointer">Error details</summary>
              <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-auto">
                {this.state.error?.stack}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}