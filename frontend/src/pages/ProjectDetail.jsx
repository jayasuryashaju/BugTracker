import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Bug as BugIcon, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useBugEvents } from '../context/NotificationsContext';
import { errorMessage, fullName, STATUSES, unwrap } from '../lib/utils';
import { ConfirmDialog, EmptyState, PageHead, PageLoader, Person, RoleBadge } from '../components/ui';
import IssueList from '../components/IssueList';
import ProjectModal from '../components/ProjectModal';

const ProjectDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [bugs, setBugs] = useState(null);
  const [status, setStatus] = useState('');
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canManage = ['Admin', 'Manager'].includes(user?.profile?.role) || user?.is_superuser;

  const loadProject = useCallback(async () => {
    try { setProject((await api.get(`projects/${id}/`)).data); setMissing(false); } catch (err) {
      if (err.response?.status === 404) setMissing(true); else toast.error(errorMessage(err));
    }
  }, [id]);

  const loadBugs = useCallback(async () => {
    try {
      const res = await api.get('bugs/', { params: { project: id, page_size: 200, ordering: '-priority_rank,-created_at', ...(status && { status }) } });
      setBugs(unwrap(res));
    } catch (err) { toast.error(errorMessage(err)); setBugs((b) => b ?? []); }
  }, [id, status]);

  useEffect(() => { setProject(null); loadProject(); }, [loadProject]);
  useEffect(() => { loadBugs(); }, [loadBugs]);
  useBugEvents(() => { loadBugs(); loadProject(); });
  useEffect(() => { if (project) document.title = `${project.name} · BugTracker Pro`; }, [project]);

  const remove = async () => {
    try { await api.delete(`projects/${id}/`); toast.success('Project deleted'); navigate('/projects', { replace: true }); }
    catch (err) { toast.error(errorMessage(err)); setDeleting(false); }
  };

  if (missing) return <EmptyState icon={AlertTriangle} title="Project not found" action={<Link to="/projects" className="btn btn--primary">All projects</Link>}>It may have been deleted, or you may not be a member.</EmptyState>;
  if (!project) return <PageLoader />;

  return (
    <div>
      <PageHead back={{ to: '/projects', label: 'Projects' }} title={<>{project.name} <span className="badge badge--plain" style={{ verticalAlign: 'middle' }}>{project.prefix}</span></>} subtitle={project.description || 'No description.'}
        actions={(
          <>
            <Link to={`/create?project=${project.id}`} className="btn btn--primary"><PlusCircle size={16} /> Log a bug</Link>
            {canManage && <button className="btn btn--secondary" onClick={() => setEditing(true)}><Pencil size={14} /> Edit</button>}
            {canManage && <button className="btn btn--danger btn--icon" aria-label="Delete project" onClick={() => setDeleting(true)}><Trash2 size={15} /></button>}
          </>
        )} />

      <div className="detail">
        <section className="card card--flush">
          <div className="card__head">
            <h2>Issues</h2><span className="muted">{project.open_bug_count} open · {project.bug_count} total</span>
            <select className="select select--sm spacer" style={{ width: 150 }} aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          {bugs === null ? <PageLoader /> : bugs.length === 0 ? (
            <EmptyState icon={BugIcon} title={status ? `No ${status.toLowerCase()} bugs` : 'No bugs in this project'}>{status ? 'Try another status.' : 'Bugs logged against this project will appear here.'}</EmptyState>
          ) : <IssueList bugs={bugs} showProject={false} />}
        </section>

        <aside className="detail__side">
          <section className="card">
            <div className="card__head"><h2>Members</h2><span className="muted spacer">{project.members.length}</span></div>
            {project.members.length === 0 ? <p className="muted" style={{ padding: 18 }}>No members yet. Admins and managers can always see this project.</p> : project.members.map((m) => (
              <div key={m.id} className="list-row">
                <Person user={m} size="md" /><span className="spacer"><RoleBadge role={m.profile?.role} /></span>
              </div>
            ))}
            <div className="card__body muted" style={{ borderTop: '1px solid var(--border)' }}>Created by {fullName(project.created_by)}</div>
          </section>
        </aside>
      </div>

      {editing && <ProjectModal project={project} onClose={() => setEditing(false)} onSaved={(p) => { setProject({ ...project, ...p }); setEditing(false); loadProject(); }} />}
      {deleting && <ConfirmDialog danger title="Delete project?" message={`“${project.name}” and its ${project.bug_count} bug${project.bug_count === 1 ? '' : 's'} will be permanently deleted. This cannot be undone.`} confirmLabel="Delete project" onConfirm={remove} onCancel={() => setDeleting(false)} />}
    </div>
  );
};

export default ProjectDetail;
