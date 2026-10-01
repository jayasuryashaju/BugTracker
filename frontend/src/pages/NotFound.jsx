import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui';

const NotFound = () => {
  useEffect(() => { document.title = 'Page not found · BugTracker Pro'; }, []);
  return (
    <EmptyState icon={Compass} title="Page not found" action={<Link to="/" className="btn btn--primary">Go to dashboard</Link>}>
      The page you&apos;re looking for doesn&apos;t exist or has moved.
    </EmptyState>
  );
};

export default NotFound;
