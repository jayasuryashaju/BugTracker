import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Ghost } from 'lucide-react';

const NotFound = () => {
  useEffect(() => {
    document.title = '404 Page Not Found | BugTracker Pro';
  }, []);

  return (
    <div className="empty-state" style={{ height: '100%', minHeight: '60vh', justifyContent: 'center' }}>
      <div className="empty-state__icon" style={{ opacity: 0.5 }}>
        <Ghost size={64} />
      </div>
      <h2 style={{ marginTop: '16px', fontSize: '2rem' }}>404</h2>
      <p className="text-muted" style={{ fontSize: '1.1rem', marginBottom: '24px' }}>
        Page not found. It might have been moved or deleted.
      </p>
      <Link to="/" className="btn btn--primary">
        Return to Dashboard
      </Link>
    </div>
  );
};

export default NotFound;
