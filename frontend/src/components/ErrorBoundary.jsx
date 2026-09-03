import React from 'react';
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="empty-state" style={{ height: '100vh', justifyContent: 'center' }}>
          <div className="empty-state__icon" style={{ color: 'var(--status-critical)' }}>
            <AlertTriangle size={48} />
          </div>
          <h2 style={{ marginTop: '16px' }}>Something went wrong</h2>
          <p className="text-muted" style={{ maxWidth: '400px', margin: '12px auto' }}>
            We're sorry, an unexpected error occurred. Please refresh the page or contact support if the problem persists.
          </p>
          <button onClick={() => window.location.reload()} className="btn btn--primary" style={{ marginTop: '16px' }}>
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
