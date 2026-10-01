import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Bug as BugIcon, CheckCircle2, FolderGit2, PlusCircle, UserX, UserCheck } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useBugEvents } from '../context/NotificationsContext';
import { fullName, unwrap } from '../lib/utils';
import { EmptyState, PageHead, RowsSkeleton } from '../components/ui';
import { HBars, LineChart, StackBar } from '../components/Charts';
import IssueList from '../components/IssueList';

const Kpi = ({ to, label, value, sub, icon: Icon, warn }) => (
  <Link to={to} className={`card card--link kpi ${warn && value > 0 ? 'kpi--warn' : ''}`}>
    <div className="kpi__label"><Icon size={15} />{label}</div>
    <div className="kpi__value">{value}</div>
    {sub && <div className="kpi__sub">{sub}</div>}
  </Link>
);

const Dashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [analytics, bugs, projs] = await Promise.all([
        api.get('bugs/analytics/', { params: { days: 14 } }),
        api.get('bugs/', { params: { page_size: 6, ordering: '-updated_at' } }),
        api.get('projects/', { params: { page_size: 4 } }),
      ]);
      setData(analytics.data);
      setRecent(unwrap(bugs));
      setProjects(unwrap(projs));
      setError(false);
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useBugEvents(load);

  const role = user?.profile?.role || 'Developer';
  const name = user?.first_name || fullName(user);

  if (error && !data) {
    return <EmptyState icon={AlertTriangle} title="Couldn't load the dashboard" action={<button className="btn btn--primary" onClick={load}>Try again</button>}>Check your connection and try again.</EmptyState>;
  }
  if (!data) {
    return (
      <div aria-busy="true">
        <PageHead title="Dashboard" />
        <div className="kpis">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 96 }} />)}</div>
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    );
  }

  const s = data.status_breakdown;
  const p = data.priority_breakdown;
  const open = s.open + s.in_progress;

  return (
    <div>
      <PageHead
        title={`Welcome back${name ? `, ${name}` : ''}`}
        subtitle={role === 'Developer' ? 'Here is the work assigned to you.' : `${user?.profile?.organization?.name || 'Your organization'} at a glance.`}
        actions={<Link to="/create" className="btn btn--primary"><PlusCircle size={16} /> Log a bug</Link>}
      />

      <div className="kpis">
        <Kpi to="/bugs?mine=true" icon={UserCheck} label="Assigned to me" value={data.assigned_to_me} sub="open bugs" />
        <Kpi to="/bugs" icon={BugIcon} label="Open work" value={open} sub={`${data.total} bugs in total`} />
        <Kpi to="/bugs?overdue=true" icon={AlertTriangle} label="Overdue" value={data.overdue} sub="past their due date" warn />
        {role === 'Developer'
          ? <Kpi to="/bugs?status=Resolved" icon={CheckCircle2} label="Resolved" value={s.resolved + s.closed} sub={`${data.resolution_rate}% of all bugs`} />
          : <Kpi to="/bugs?unassigned=true" icon={UserX} label="Unassigned" value={data.unassigned} sub="need an owner" />}
      </div>

      {data.total === 0 ? (
        <div className="card">
          <EmptyState icon={BugIcon} title="No bugs yet" action={<Link to="/create" className="btn btn--primary"><PlusCircle size={16} /> Log the first bug</Link>}>
            Charts and trends will appear here once your team starts logging work.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="dash-grid">
            <section className="card span-7">
              <div className="card__head"><h2>Created vs. resolved</h2><span className="muted spacer">Last 14 days</span></div>
              <div className="card__body">
                <LineChart
                  data={data.trend}
                  series={[{ key: 'created', label: 'Created', color: 'var(--s1)' }, { key: 'resolved', label: 'Resolved', color: 'var(--s3)' }]}
                />
              </div>
            </section>
            <div className="span-5 stack">
              <section className="card">
                <div className="card__head"><h2>Status</h2><span className="muted spacer">{data.resolution_rate}% resolved</span></div>
                <div className="card__body">
                  <StackBar segments={[
                    { label: 'Open', value: s.open, color: 'var(--s1)' },
                    { label: 'In progress', value: s.in_progress, color: 'var(--s2)' },
                    { label: 'Resolved', value: s.resolved, color: 'var(--s3)' },
                    { label: 'Closed', value: s.closed, color: 'var(--s4)' },
                  ]} />
                </div>
              </section>
              <section className="card">
                <div className="card__head"><h2>Priority</h2></div>
                <div className="card__body">
                  <HBars rows={[
                    { label: 'Critical', value: p.critical, color: 'var(--ramp-4)' },
                    { label: 'High', value: p.high, color: 'var(--ramp-3)' },
                    { label: 'Medium', value: p.medium, color: 'var(--ramp-2)' },
                    { label: 'Low', value: p.low, color: 'var(--ramp-1)' },
                  ]} />
                </div>
              </section>
            </div>
          </div>

          <section className="card card--flush" style={{ marginBottom: 16 }}>
            <div className="card__head">
              <h2>{role === 'Developer' ? 'Recently updated for you' : 'Recently updated'}</h2>
              <Link to="/bugs" className="btn btn--ghost btn--sm spacer">View all <ArrowRight size={14} /></Link>
            </div>
            {recent ? <IssueList bugs={recent} /> : <RowsSkeleton />}
          </section>
        </>
      )}

      {projects.length > 0 && (
        <section>
          <div className="row row--between" style={{ marginBottom: 12 }}>
            <h2>Projects</h2>
            <Link to="/projects" className="btn btn--ghost btn--sm">All projects <ArrowRight size={14} /></Link>
          </div>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {projects.map((proj) => (
              <Link key={proj.id} to={`/project/${proj.id}`} className="card card--link" style={{ padding: 16 }}>
                <div className="row"><FolderGit2 size={16} style={{ color: 'var(--accent-text)' }} /><b className="truncate">{proj.name}</b><span className="issue__id spacer">{proj.prefix}</span></div>
                <div className="muted" style={{ marginTop: 8 }}>{proj.open_bug_count} open · {proj.bug_count} total</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default Dashboard;
