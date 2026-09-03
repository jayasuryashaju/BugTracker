import Loader from '../components/Loader';
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { FolderGit2, ArrowLeft } from 'lucide-react';

const priorityBadgeClass = (priority) => {
  const map = {
    'Low': 'badge--low',
    'Medium': 'badge--medium',
    'High': 'badge--high',
    'Critical': 'badge--critical',
  };
  return map[priority] || '';
};

const statusBadgeClass = (status) => {
  const map = {
    'Open': 'badge--open',
    'In Progress': 'badge--inprogress',
    'Resolved': 'badge--resolved',
    'Closed': 'badge--closed',
  };
  return map[status] || '';
};

const ProjectDetail = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projRes, bugsRes] = await Promise.all([
          api.get(`projects/${id}/`),
          api.get(`bugs/?project=${id}`)
        ]);
        setProject(projRes.data);
        setBugs(Array.isArray(bugsRes.data) ? bugsRes.data : bugsRes.data.results || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    if (project) {
      document.title = `${project.name} | Projects | BugTracker Pro`;
    }
  }, [project]);

  if (loading) return <Loader fullScreen />;
  if (!project) return <div>Project not found</div>;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/projects" className="btn btn--ghost"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="page-header__title flex items-center gap-2">
              <FolderGit2 size={24} style={{ color: 'var(--accent)' }} /> {project.name}
            </h1>
            <p className="page-header__subtitle">
              {project.description || 'No description provided.'}
            </p>
          </div>
        </div>
      </div>

      <div className="detail-layout">
        {/* Main Bug List */}
        <div className="flex-col gap-4" style={{ display: 'flex', flex: 1 }}>
          <div className="card">
            <div className="card__header">
              <span className="card__title">Project Issues ({bugs.length})</span>
            </div>
            <div className="card__body" style={{ padding: 0 }}>
              {bugs.length > 0 ? (
                <div className="bug-table">
                  <div className="bug-table__header" style={{ gridTemplateColumns: 'minmax(200px, 1.5fr) minmax(180px, 1fr) 120px 160px' }}>
                    <span>Issue</span>
                    <span>Status</span>
                    <span>Priority</span>
                    <span>Assigned To</span>
                  </div>
                  {bugs.map(bug => (
                    <Link key={bug.id} to={`/bug/${bug.id}`} className="bug-table__row" style={{ textDecoration: 'none', color: 'inherit', gridTemplateColumns: 'minmax(200px, 1.5fr) minmax(180px, 1fr) 120px 160px' }}>
                      <div className="bug-table__title">
                        <span className="bug-table__id">{bug.display_id}</span>
                        {bug.title}
                      </div>
                      <div className="bug-table__cell">
                        <span className={`badge ${statusBadgeClass(bug.status)}`}>
                          {bug.status}
                        </span>
                      </div>
                      <div className="bug-table__cell">
                        <span className={`badge ${priorityBadgeClass(bug.priority)}`}>
                          {bug.priority}
                        </span>
                      </div>
                      <div className="bug-table__cell">
                        {bug.assigned_to_detail ? `${bug.assigned_to_detail.first_name || ''} ${bug.assigned_to_detail.last_name || ''}`.trim() || bug.assigned_to_detail.username : <span className="text-muted">Unassigned</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No issues reported for this project yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="card" style={{ width: '320px', alignSelf: 'flex-start', position: 'sticky', top: '28px' }}>
          <div className="card__header">
            <span className="card__title">Assigned Team ({project.members?.length || 0})</span>
          </div>
          <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {project.members && project.members.length > 0 ? (
              project.members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div className="topbar__avatar" style={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                    {m.first_name?.[0]?.toUpperCase() || m.username?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{m.first_name || m.username}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.profile?.role || 'Developer'}</div>
                  </div>
                </div>
              ))
            ) : (
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>No team members assigned</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
