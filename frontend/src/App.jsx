import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Loader from './components/Loader';
import BugList from './pages/BugList';
import Bugs from './pages/Bugs';
import BugDetail from './pages/BugDetail';
import BugCreate from './pages/BugCreate';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Team from './pages/Team';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import OrganizationSettings from './pages/OrganizationSettings';
import Notifications from './pages/Notifications';
import NotFound from './pages/NotFound';
import ErrorBoundary from './components/ErrorBoundary';
import KanbanBoard from './pages/KanbanBoard';
import { Toaster } from 'react-hot-toast';
import './index.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loader fullScreen text="Loading..." />;
  if (!user) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <ErrorBoundary>
      <Toaster position="top-right" />
      <Router>
        <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><BugList /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/project/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
          <Route path="/bugs" element={<ProtectedRoute><Bugs /></ProtectedRoute>} />
          <Route path="/create" element={<ProtectedRoute><BugCreate /></ProtectedRoute>} />
          <Route path="/board" element={<ProtectedRoute><KanbanBoard /></ProtectedRoute>} />
          <Route path="/bug/:id" element={<ProtectedRoute><BugDetail /></ProtectedRoute>} />
          <Route path="/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
          <Route path="/organization" element={<ProtectedRoute><OrganizationSettings /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </Router>
    </ErrorBoundary>
  );
}

export default App;
