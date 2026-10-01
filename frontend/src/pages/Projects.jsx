import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderGit2, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import useDebounced from '../hooks/useDebounced';
import { errorMessage, unwrap } from '../lib/utils';
import { Avatar, EmptyState, PageHead } from '../components/ui';
import ProjectModal from '../components/ProjectModal';

const Projects = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const q = useDebounced(search, 250);
  const canManage = ['Admin', 'Manager'].includes(user?.profile?.role) || user?.is_superuser;

  const load = useCallback(async () => {
    try {
      const res = await api.get('projects/', { params: { page_size: 500, ...(q && { search: q }) } });
      setProjects(unwrap(res));
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load projects.'));
      setProjects((p) => p ?? []);
    }
  }, [q]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHead title="Projects" subtitle={canManage ? 'Group bugs by product or team and choose who works on them.' : 'Projects you are a member of.'}
        actions={canManage && <button className="btn btn--primary" onClick={() => setCreating(true)}><Plus size={16} /> New project</button>} />

      <div className="input-icon" style={{ maxWidth: 360, marginBottom: 16 }}>
        <Search size={15} /><input className="input" type="search" placeholder="Search projects…" aria-label="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {projects === null ? (
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 160 }} />)}</div>
      ) : projects.length === 0 ? (
        <div className="card"><EmptyState icon={FolderGit2} title={q ? 'No projects match your search' : 'No projects yet'} action={!q && canManage && <button className="btn btn--primary" onClick={() => setCreating(true)}>Create the first project</button>}>
          {q ? 'Try a different name.' : canManage ? 'Projects keep bugs organized and control who sees what.' : 'Ask an admin or manager to add you to a project.'}
        </EmptyState></div>
      ) : (
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {projects.map((p) => (
            <Link key={p.id} to={`/project/${p.id}`} className="card card--link" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="row">
                <FolderGit2 size={18} style={{ color: 'var(--accent-text)' }} /><h3 className="truncate grow">{p.name}</h3><span className="badge badge--plain">{p.prefix}</span>
              </div>
              <p className="muted" style={{ minHeight: 40, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description || 'No description.'}</p>
              <div className="row row--between">
                <span className="row" style={{ gap: 0 }}>
                  {p.members.slice(0, 5).map((m, i) => <span key={m.id} style={{ marginLeft: i ? -8 : 0, boxShadow: '0 0 0 2px var(--surface)', borderRadius: '50%' }}><Avatar user={m} size="sm" /></span>)}
                  {p.members.length > 5 && <span className="muted" style={{ marginLeft: 8 }}>+{p.members.length - 5}</span>}
                  {p.members.length === 0 && <span className="muted">No members</span>}
                </span>
                <span className="muted">{p.open_bug_count} open · {p.bug_count} total</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {creating && <ProjectModal onClose={() => setCreating(false)} onSaved={(p) => navigate(`/project/${p.id}`)} />}
    </div>
  );
};

export default Projects;
