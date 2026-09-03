import Loader from '../components/Loader';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import {
  Bug as BugIcon, AlertCircle, Clock, CheckCircle2,
  TrendingUp, Activity, PlusCircle, ArrowRight, FolderGit2, ShieldCheck, Check
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';

const priorityBadges = {
  Low: 'badge--low',
  Medium: 'badge--medium',
  High: 'badge--high',
  Critical: 'badge--critical',
};

const statusBadges = {
  Open: 'badge--open',
  'In Progress': 'badge--inprogress',
  Resolved: 'badge--resolved',
  Closed: 'badge--closed',
};

const COLORS = ['#3b82f6', '#f59e0b', '#10b981']; // Open, In Progress, Resolved/Closed
const PRIORITY_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6']; // Critical, High, Medium, Low

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bugs, setBugs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const role = user?.profile?.role || 'Developer';
  const isAdmin = role === 'Admin' || user?.is_superuser;
  const isManagerOrAdmin = isAdmin || role === 'Manager';
  const isAdminOrTester = isManagerOrAdmin || role === 'Tester';

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [bugsRes, analyticsRes, projectsRes] = await Promise.all([
          api.get('bugs/'),
          api.get('bugs/analytics/'),
          api.get('projects/')
        ]);
        setBugs(Array.isArray(bugsRes.data) ? bugsRes.data : bugsRes.data.results || []);
        setAnalytics(analyticsRes.data);
        setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : projectsRes.data.results || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, []);

  useEffect(() => {
    const handleBugEvent = (e) => {
      const { action, bug } = e.detail;
      setBugs(prev => {
        if (action === 'created') return [bug, ...prev];
        if (action === 'deleted') return prev.filter(b => b.id !== bug.id);
        if (action === 'updated') {
          return prev.map(b => b.id === bug.id ? { ...b, ...bug } : b);
        }
        return prev;
      });
    };
    window.addEventListener('ws_bug_event', handleBugEvent);
    return () => window.removeEventListener('ws_bug_event', handleBugEvent);
  }, []);

  if (loading) return <Loader fullScreen />;

  const total = analytics?.total || bugs.length;
  const openCount = analytics?.status_breakdown?.open || 0;
  const inProgressCount = analytics?.status_breakdown?.in_progress || 0;
  const resolvedCount = (analytics?.status_breakdown?.resolved || 0) + (analytics?.status_breakdown?.closed || 0);
  const resolutionRate = analytics?.resolution_rate || 0;

  const openPct = total ? Math.round((openCount / total) * 100) : 0;
  const inProgressPct = total ? Math.round((inProgressCount / total) * 100) : 0;
  const resolvedPct = total ? Math.round((resolvedCount / total) * 100) : 0;

  const critCount = analytics?.priority_breakdown?.critical || 0;
  const highCount = analytics?.priority_breakdown?.high || 0;
  const medCount = analytics?.priority_breakdown?.medium || 0;
  const lowCount = analytics?.priority_breakdown?.low || 0;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">
            {isAdmin ? 'Organization Analytics & Overview' : 'Overview & Focus Tasks'}
          </h1>
          <p className="page-header__subtitle">
            Welcome back, {user?.first_name || user?.username}! Logged in as <strong style={{ color: 'var(--text-primary)' }}>{role}</strong> at <strong>{user?.profile?.organization?.name || 'Organization'}</strong>.
          </p>
        </div>
        {isAdminOrTester && (
          <Link to="/create" className="btn btn--primary">
            <PlusCircle size={16} /> Log a Bug
          </Link>
        )}
      </div>

      {/* Metric Cards Row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-card__value">{total}</div>
            <div className="stat-card__label">Total Issues Reported</div>
          </div>
          <div className="stat-card__icon" style={{ backgroundColor: 'var(--accent-muted)', color: 'var(--accent)' }}>
            <BugIcon size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-card__value" style={{ color: 'var(--status-open)' }}>{openCount}</div>
            <div className="stat-card__label">Open ({openPct}%)</div>
          </div>
          <div className="stat-card__icon" style={{ backgroundColor: 'var(--status-open-bg)', color: 'var(--status-open)' }}>
            <AlertCircle size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-card__value" style={{ color: 'var(--status-progress)' }}>{inProgressCount}</div>
            <div className="stat-card__label">In Progress ({inProgressPct}%)</div>
          </div>
          <div className="stat-card__icon" style={{ backgroundColor: 'var(--status-progress-bg)', color: 'var(--status-progress)' }}>
            <Clock size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-card__value" style={{ color: 'var(--status-resolved)' }}>{resolvedCount}</div>
            <div className="stat-card__label">Resolved / Closed ({resolvedPct}%)</div>
          </div>
          <div className="stat-card__icon" style={{ backgroundColor: 'var(--status-resolved-bg)', color: 'var(--status-resolved)' }}>
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Informative Analytics Section */}
      <div className="card chart-card mb-6" style={{ padding: '24px', marginBottom: '24px' }}>
        <div className="card__header mb-4 analytics-header" style={{ borderBottom: 'none', padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={18} style={{ color: 'var(--accent)' }} />
            <span className="card__title" style={{ fontSize: '1.05rem' }}>Resolution Performance & Priority Severity Breakdown</span>
          </div>
          <span className="badge badge--resolved" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
            Resolution Efficiency Rate: {resolutionRate}%
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
          {/* Status Breakdown Donut Chart */}
          <div style={{ background: 'var(--bg-base)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Issue Lifecycle Status
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {resolvedCount} of {total} resolved
              </span>
            </div>

            <div style={{ width: '100%', height: 220 }}>
              {total > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Open', value: openCount },
                        { name: 'In Progress', value: inProgressCount },
                        { name: 'Resolved/Closed', value: resolvedCount }
                      ]}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[
                        { name: 'Open', value: openCount },
                        { name: 'In Progress', value: inProgressCount },
                        { name: 'Resolved/Closed', value: resolvedCount }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>No data available</span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <div className="flex items-center gap-2" style={{ background: 'var(--bg-surface)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--status-open)', flexShrink: 0 }} />
                <span>Open: <strong>{openCount}</strong></span>
              </div>
              <div className="flex items-center gap-2" style={{ background: 'var(--bg-surface)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--status-progress)', flexShrink: 0 }} />
                <span>Progress: <strong>{inProgressCount}</strong></span>
              </div>
              <div className="flex items-center gap-2" style={{ background: 'var(--bg-surface)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--status-resolved)', flexShrink: 0 }} />
                <span>Resolved: <strong>{resolvedCount}</strong></span>
              </div>
            </div>
          </div>

          {/* Severity Breakdown Bar Chart */}
          <div style={{ background: 'var(--bg-base)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '14px', color: 'var(--text-primary)' }}>
              Priority Severity Breakdown
            </div>
            
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[
                  { name: 'Critical', issues: critCount },
                  { name: 'High', issues: highCount },
                  { name: 'Medium', issues: medCount },
                  { name: 'Low', issues: lowCount }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)' }} />
                  <RechartsTooltip cursor={{ fill: 'var(--bg-surface)' }} contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Bar dataKey="issues" radius={[4, 4, 0, 0]}>
                    {[
                      { name: 'Critical', issues: critCount },
                      { name: 'High', issues: highCount },
                      { name: 'Medium', issues: medCount },
                      { name: 'Low', issues: lowCount }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[index % PRIORITY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Trend Area Chart */}
      {analytics?.trend && analytics.trend.length > 0 && (
        <div className="card mb-6" style={{ padding: '24px', marginBottom: '24px' }}>
          <div className="card__header mb-4 flex justify-between items-center" style={{ borderBottom: 'none', padding: 0 }}>
            <div className="flex items-center gap-2">
              <Activity size={18} style={{ color: 'var(--status-open)' }} />
              <span className="card__title" style={{ fontSize: '1.05rem' }}>Bugs Logged Trend (Last 7 Days)</span>
            </div>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.trend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBugs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--status-open)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--status-open)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)' }} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <RechartsTooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                <Area type="monotone" dataKey="bugs" stroke="var(--status-open)" fillOpacity={1} fill="url(#colorBugs)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Projects Health Overview Grid */}
      {projects.length > 0 && (
        <div className="mb-6" style={{ marginBottom: '24px' }}>
          <div className="flex justify-between items-center mb-3">
            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderGit2 size={18} style={{ color: 'var(--accent)' }} /> Projects Health & Issues Overview
            </span>
            <Link to="/projects" className="btn btn--ghost" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
              View All Projects →
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {projects.slice(0, 4).map(p => (
              <div key={p.id} className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{p.name}</span>
                  <span className="badge badge--open" style={{ fontSize: '0.72rem' }}>{p.bug_count} Bugs</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.description || 'Active project module'}
                </p>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Members: {p.members?.length || 0}</span>
                  <span>Managed by {p.created_by?.first_name || p.created_by?.username}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Issues List */}
      <div className="card">
        <div className="card__header flex justify-between items-center">
          <span className="card__title flex items-center gap-2">
            <Activity size={18} /> {role === 'Developer' ? 'Recent Assigned Bugs' : 'Recent Organization Issues'}
          </span>
          <Link to="/bugs" className="btn btn--ghost" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
            View All Bugs <ArrowRight size={14} />
          </Link>
        </div>
        <div className="card__body" style={{ padding: 0 }}>
          {bugs.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="bug-table">
                <div className="bug-table__header">
                  <span>Issue</span>
                  <span>Project</span>
                  <span>Status</span>
                  <span>Priority</span>
                  <span>Assigned To</span>
                </div>
                {bugs.slice(0, 7).map(bug => (
                  <div
                    key={bug.id}
                    className="bug-table__row"
                    onClick={() => navigate(`/bug/${bug.id}`)}
                  >
                    <div className="bug-table__title">
                      <span className="bug-table__id">{bug.display_id}</span>
                      {bug.title}
                    </div>
                    <div className="bug-table__cell">
                      {bug.project_detail ? (
                        <span className="badge badge--open flex items-center gap-1" style={{ fontSize: '0.72rem', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <FolderGit2 size={12} style={{ flexShrink: 0 }} /> 
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{bug.project_detail.name}</span>
                        </span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.78rem' }}>General</span>
                      )}
                    </div>
                    <div>
                      <span className={`badge ${statusBadges[bug.status] || 'badge--open'}`}>
                        {bug.status}
                      </span>
                    </div>
                    <div>
                      <span className={`badge ${priorityBadges[bug.priority] || 'badge--medium'}`}>
                        {bug.priority}
                      </span>
                    </div>
                    <div className="bug-table__cell">
                      {bug.assigned_to ? (
                        <div className="flex items-center gap-2">
                          <div className="topbar__avatar" style={{ width: 22, height: 22, fontSize: '0.68rem' }}>
                            {bug.assigned_to.first_name?.[0]?.toUpperCase() || bug.assigned_to.username?.[0]?.toUpperCase()}
                          </div>
                          <span style={{ fontSize: '0.8rem' }}>
                            {bug.assigned_to.first_name ? `${bug.assigned_to.first_name}` : bug.assigned_to.username}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>Unassigned</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile card list */}
              <div className="bug-card-mobile">
                {bugs.slice(0, 7).map(bug => (
                  <div
                    key={bug.id}
                    className="bug-card-mobile-item"
                    onClick={() => navigate(`/bug/${bug.id}`)}
                  >
                    <div className="bug-card-mobile-item__top">
                      <div className="bug-card-mobile-item__title">{bug.title}</div>
                      <span className={`badge ${priorityBadges[bug.priority] || 'badge--medium'}`} style={{ flexShrink: 0 }}>
                        {bug.priority}
                      </span>
                    </div>
                    <div className="bug-card-mobile-item__meta">
                      <span className="bug-card-mobile-item__id">{bug.display_id}</span>
                      <span className={`badge ${statusBadges[bug.status] || 'badge--open'}`}>{bug.status}</span>
                      {bug.project_detail && (
                        <span className="bug-card-mobile-item__project">
                          <FolderGit2 size={11} />{bug.project_detail.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon"><BugIcon size={28} /></div>
              <div className="empty-state__title">No issues assigned or logged yet</div>
              <div className="empty-state__desc">
                {role === 'Developer' ? 'When bugs are assigned to you, they will appear here' : 'Click "Log a Bug" to report the first issue'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
