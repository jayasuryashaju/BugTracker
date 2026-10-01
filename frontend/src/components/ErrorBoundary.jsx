import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="fullscreen-center">
        <div className="empty">
          <div className="empty__icon" style={{ color: 'var(--danger)' }}><AlertTriangle size={24} /></div>
          <h3>Something went wrong</h3>
          <p>An unexpected error occurred. Reloading usually fixes it.</p>
          <button className="btn btn--primary" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
