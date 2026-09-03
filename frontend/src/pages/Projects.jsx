import Loader from '../components/Loader';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { FolderGit2, Plus, Users, Bug as BugIcon, Check, Shield } from 'lucide-react';

const Projects = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Project Form Modal State
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const role = user?.profile?.role || 'Developer';
  const isManagerOrAdmin = role === 'Admin' || role === 'Manager' || user?.is_superuser;

  const fetchProjects = async () => {
    try {
      const [projRes, membersRes] = await Promise.all([
        api.get('projects/'),
        api.get('users/')
      ]);
      setProjects(Array.isArray(projRes.data) ? projRes.data : projRes.data.results || []);
      setTeamMembers(Array.isArray(membersRes.data) ? membersRes.data : membersRes.data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleMemberToggle = (memberId) => {
    setSelectedMemberIds(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await api.post('projects/', {
        name,
        description,
        member_ids: selectedMemberIds
      });
      setName('');
      setDescription('');
      setSelectedMemberIds([]);
      setShowModal(false);
      toast.success('Project created successfully!');
      fetchProjects();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || err.response?.data?.name?.[0] || 'Failed to create project.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader fullScreen />;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Projects</h1>
          <p className="page-header__subtitle">
            {isManagerOrAdmin ? 'Manage projects and assign team members' : 'Projects assigned to you'}
          </p>
        </div>
        {isManagerOrAdmin && (
          <button onClick={() => setShowModal(true)} className="btn btn--primary">
            <Plus size={16} /> Create Project
          </button>
        )}
      </div>

      {/* New Project Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}
        >
          <div className="card animate-in" style={{ width: '100%', maxWidth: '580px' }}>
            <div className="card__header flex justify-between items-center">
              <span className="card__title flex items-center gap-2">
                <FolderGit2 size={18} style={{ color: 'var(--accent)' }} /> Create New Project
              </span>
              <button onClick={() => setShowModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}>✕</button>
            </div>
            <div className="card__body">
              <form onSubmit={handleCreateProject} className="flex-col gap-4" style={{ display: 'flex' }}>
                <div className="form-group">
                  <label className="form-label">Project Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. Mobile iOS App, Payment Gateway"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Brief description of project goals and scope"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    style={{ minHeight: '70px' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Assign Testers & Developers</label>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px' }}>
                    {teamMembers.map(m => {
                      const mName = m.first_name ? `${m.first_name} ${m.last_name || ''}` : m.username;
                      const mRole = m.profile?.role || 'Developer';
                      const isSelected = selectedMemberIds.includes(m.id);

                      return (
                        <div
                          key={m.id}
                          onClick={() => handleMemberToggle(m.id)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                            marginBottom: '4px'
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ accentColor: 'var(--accent)' }}
                            />
                            <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 600 : 400 }}>{mName}</span>
                          </div>
                          <span className="badge badge--open" style={{ fontSize: '0.7rem' }}>{mRole}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-3" style={{ paddingTop: '8px' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn--secondary">Cancel</button>
                  <button type="submit" className="btn btn--primary" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {projects.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {projects.map(proj => (
            <div 
              key={proj.id} 
              className="card" 
              onClick={() => navigate(`/project/${proj.id}`)}
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '260px', cursor: 'pointer', transition: 'transform 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="card__header flex justify-between items-center mb-2" style={{ padding: '16px 20px', minHeight: '60px' }}>
                  <span className="card__title flex items-center gap-2" style={{ fontSize: '1rem', flex: 1, minWidth: 0 }}>
                    <FolderGit2 size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} /> 
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{proj.name}</span>
                  </span>
                  <span className="badge badge--inprogress" style={{ fontSize: '0.75rem', flexShrink: 0, marginLeft: '8px' }}>
                    {proj.bug_count} Issues
                  </span>
                </div>
                <p style={{ padding: '0 20px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.4 }}>
                  {proj.description || 'No description provided.'}
                </p>
              </div>

              <div style={{ padding: '0 20px' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
                  Assigned Team ({proj.members?.length || 0})
                </div>
                <div className="flex flex-wrap gap-1 mb-4" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {proj.members && proj.members.length > 0 ? (
                    <>
                      {proj.members.slice(0, 4).map(m => (
                        <span key={m.id} className="badge badge--open" style={{ fontSize: '0.7rem' }}>
                          {m.first_name || m.username} ({m.profile?.role || 'Dev'})
                        </span>
                      ))}
                      {proj.members.length > 4 && (
                        <span className="badge badge--closed" style={{ fontSize: '0.7rem' }}>
                          +{proj.members.length - 4} more
                        </span>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>No members assigned</span>
                  )}
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Managed by {proj.created_by?.first_name || proj.created_by?.username || 'Unknown'}
                </span>
                <Link 
                  to={`/project/${proj.id}`} 
                  onClick={(e) => e.stopPropagation()} 
                  className="btn btn--secondary btn--sm" 
                  style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: 600 }}
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state__icon"><FolderGit2 size={32} /></div>
            <div className="empty-state__title">No Projects Found</div>
            <div className="empty-state__desc">
              {isManagerOrAdmin ? 'Click "Create Project" above to organize your team and bug tracking.' : 'You have not been assigned to any project yet.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
