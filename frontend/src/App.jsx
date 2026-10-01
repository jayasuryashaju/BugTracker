import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationsProvider } from './context/NotificationsContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { FullScreenLoader, PageLoader } from './components/ui';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Bugs = lazy(() => import('./pages/Bugs'));
const BugDetail = lazy(() => import('./pages/BugDetail'));
const BugCreate = lazy(() => import('./pages/BugCreate'));
const KanbanBoard = lazy(() => import('./pages/KanbanBoard'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Team = lazy(() => import('./pages/Team'));
const OrganizationSettings = lazy(() => import('./pages/OrganizationSettings'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));
const NotFound = lazy(() => import('./pages/NotFound'));

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader text="Loading your workspace…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </Layout>
  );
};

const toastOptions = {
  style: {
    background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border-strong)',
    boxShadow: 'var(--shadow)', fontSize: '13.5px', maxWidth: 380,
  },
};

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <NotificationsProvider>
            <Toaster position="top-right" toastOptions={toastOptions} />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Protected><Dashboard /></Protected>} />
              <Route path="/bugs" element={<Protected><Bugs /></Protected>} />
              <Route path="/bug/:id" element={<Protected><BugDetail /></Protected>} />
              <Route path="/create" element={<Protected><BugCreate /></Protected>} />
              <Route path="/board" element={<Protected><KanbanBoard /></Protected>} />
              <Route path="/projects" element={<Protected><Projects /></Protected>} />
              <Route path="/project/:id" element={<Protected><ProjectDetail /></Protected>} />
              <Route path="/team" element={<Protected><Team /></Protected>} />
              <Route path="/organization" element={<Protected><OrganizationSettings /></Protected>} />
              <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
              <Route path="/profile" element={<Protected><Profile /></Protected>} />
              <Route path="/projects/:id" element={<Navigate to="/projects" replace />} />
              <Route path="*" element={<Protected><NotFound /></Protected>} />
            </Routes>
          </NotificationsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
