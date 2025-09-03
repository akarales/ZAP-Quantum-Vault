import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('[ErrorBoundary] Error caught:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Component stack trace:', errorInfo.componentStack);
    console.error('[ErrorBoundary] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
          <div className="max-w-2xl w-full">
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
              <h2 className="text-xl font-bold text-red-400 mb-4">
                Something went wrong
              </h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-red-300 mb-2">Error Message:</h3>
                  <p className="text-gray-300 font-mono text-sm bg-gray-800 p-3 rounded">
                    {this.state.error?.message || 'Unknown error occurred'}
                  </p>
                </div>

                {this.state.error?.stack && (
                  <div>
                    <h3 className="font-semibold text-red-300 mb-2">Stack Trace:</h3>
                    <pre className="text-xs text-gray-400 bg-gray-800 p-3 rounded overflow-auto max-h-40">
                      {this.state.error.stack}
                    </pre>
                  </div>
                )}

                {this.state.errorInfo?.componentStack && (
                  <div>
                    <h3 className="font-semibold text-red-300 mb-2">Component Stack:</h3>
                    <pre className="text-xs text-gray-400 bg-gray-800 p-3 rounded overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>

              <div className="mt-6 flex space-x-4">
                <button
                  onClick={() => window.location.reload()}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
                >
                  Reload Page
                </button>
                <button
                  onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
