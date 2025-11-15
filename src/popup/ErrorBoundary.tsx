/**
 * Error Boundary Component
 * Catches React errors and displays fallback UI
 */

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    // Optionally report to error service if user has opted in
    chrome.storage.sync.get('errorReportingEnabled', (data) => {
      if (data.errorReportingEnabled) {
        chrome.runtime.sendMessage({
          type: 'REPORT_ERROR',
          data: {
            message: error.message,
            stack: error.stack,
            context: 'popup',
            componentStack: errorInfo.componentStack,
          },
        });
      }
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            <h2>Oops! Something went wrong</h2>
            <p className="error-message">
              The extension encountered an unexpected error.
            </p>
            {this.state.error && (
              <details className="error-details">
                <summary>Error details</summary>
                <pre>{this.state.error.message}</pre>
              </details>
            )}
            <div className="error-actions">
              <button onClick={this.handleReset} className="btn-primary">
                Try Again
              </button>
              <button
                onClick={() => chrome.storage.sync.clear()}
                className="btn-secondary"
              >
                Reset Extension
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
