import Loader from '../components/Loader';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { PlusCircle, Search, Filter, Bug as BugIcon, ArrowUpDown, RefreshCw, FolderGit2, Download, Save, Bookmark } from 'lucide-react';

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

const Bugs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bugs, setBugs] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [savedFilters, setSavedFilters] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [sortBy, setSortBy] = useState('-created_at');

  const role = user?.profile?.role || 'Developer';
  const isAdminOrTester = role === 'Admin' || role === 'Tester' || role === 'Manager' || user?.is_superuser;

  useEffect(() => {
    Promise.all([
      api.get('users/'),
      api.get('projects/'),
      api.get('filters/')
    ]).then(([usersRes, projRes, filtersRes]) => {
      setTeamMembers(Array.isArray(usersRes.data) ? usersRes.data : usersRes.data.results || []);
      setProjects(Array.isArray(projRes.data) ? projRes.data : projRes.data.results || []);
      setSavedFilters(Array.isArray(filtersRes.data) ? filtersRes.data : filtersRes.data.results || []);
    }).catch(err => console.error(err));
  }, []);

  const handleSaveFilter = async () => {
    const name = prompt("Enter a name for this saved filter (e.g. 'My Critical Bugs'):");
    if (!name) return;
    const criteria = { status: statusFilter, priority: priorityFilter, assignee: assigneeFilter, project: projectFilter, search: search };
    try {
      const res = await api.post('filters/', { name, criteria });
      setSavedFilters([...savedFilters, res.data]);
    } catch (err) { console.error(err); }
  };

  const loadFilter = (id) => {
    if (!id) {
      // Clear filters
      setStatusFilter(''); setPriorityFilter(''); setAssigneeFilter(''); setProjectFilter(''); setSearch('');
      return;
    }
    const filter = savedFilters.find(f => f.id === id);
    if (filter) {
      setStatusFilter(filter.criteria.status || '');
      setPriorityFilter(filter.criteria.priority || '');
      setAssigneeFilter(filter.criteria.assignee || '');
      setProjectFilter(filter.criteria.project || '');
      setSearch(filter.criteria.search || '');
    }
  };

  const fetchBugs = () => {
    let url = `bugs/?ordering=${sortBy}&`;
    if (statusFilter) url += `status=${encodeURIComponent(statusFilter)}&`;
    if (priorityFilter) url += `priority=${encodeURIComponent(priorityFilter)}&`;
    if (assigneeFilter) url += `assigned_to=${encodeURIComponent(assigneeFilter)}&`;
    if (projectFilter) url += `project=${encodeURIComponent(projectFilter)}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;

    api.get(url)
      .then(res => {
        setBugs(Array.isArray(res.data) ? res.data : res.data.results || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchBugs();
  }, [statusFilter, priorityFilter, assigneeFilter, projectFilter, sortBy, search]);

  useEffect(() => {
    const handleBugEvent = (e) => {
      const { action, bug } = e.detail;
      setBugs(prev => {
        if (action === 'created') {
          // Add if it matches our basic filters (this is rough since full filtering is backend)
          // For now just add to top, or we can rely on users to refresh for perfect filtering.
          // Let's just prepend.
          return [bug, ...prev];
        }
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

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setAssigneeFilter('');
    setProjectFilter('');
    setSortBy('-created_at');
  };

  const handleExportCSV = () => {
    if (bugs.length === 0) return;
    
    const headers = ['ID', 'Title', 'Status', 'Priority', 'Project', 'Created By', 'Assigned To', 'Created At'];
    
    const rows = bugs.map(bug => [
      bug.display_id,
      `"${bug.title.replace(/"/g, '""')}"`,
      bug.status,
      bug.priority,
      `"${(bug.project_details?.name || 'General').replace(/"/g, '""')}"`,
      bug.created_by?.username || '',
      bug.assigned_to_details?.username || 'Unassigned',
      new Date(bug.created_at).toISOString()
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bug_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">All Issues & Bugs</h1>
          <p className="page-header__subtitle">
            {role === 'Developer' ? 'Bugs assigned to you' : 'Filter, search, and track issues across your organization'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleExportCSV} className="btn btn--secondary">
            <Download size={16} /> Export CSV
          </button>
          {isAdminOrTester && (
            <Link to="/create" className="btn btn--primary">
              <PlusCircle size={16} /> Log a Bug
            </Link>
          )}
        </div>
      </div>

      {/* Advanced Filters Toolbar */}
      <div className="card mb-6" style={{ padding: '18px 20px' }}>
        <div className="filter-toolbar" style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: 2, minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 36 }}
              placeholder="Search by title or description..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Project Filter */}
          <div style={{ flex: 1, minWidth: '150px' }}>
            <select className="form-select" value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ flex: 1, minWidth: '130px' }}>
            <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div style={{ flex: 1, minWidth: '130px' }}>
            <select className="form-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
              <option value="">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          {/* Assignee Filter */}
          {role !== 'Developer' && (
            <div style={{ flex: 1, minWidth: '140px' }}>
              <select className="form-select" value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}>
                <option value="">All Assignees</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.first_name ? `${m.first_name}` : m.username}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort By */}
          <div style={{ flex: 1, minWidth: '140px' }}>
            <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="-created_at">Newest First</option>
              <option value="created_at">Oldest First</option>
              <option value="priority">Priority Low-to-High</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(search || statusFilter || priorityFilter || assigneeFilter || projectFilter || sortBy !== '-created_at') && (
            <button onClick={clearFilters} className="btn btn--ghost" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
              <RefreshCw size={14} /> Clear
            </button>
          )}

          {/* Saved Filters Dropdown */}
          <div style={{ flex: 1, minWidth: '160px', marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <select className="form-select" onChange={e => loadFilter(e.target.value)} style={{ backgroundColor: 'var(--bg-active)' }}>
              <option value="">-- Load Saved Filter --</option>
              {savedFilters.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <button onClick={handleSaveFilter} className="btn btn--ghost" style={{ padding: '8px 12px' }} title="Save Current Filter">
              <Save size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Issues Table (desktop) + Mobile Cards */}
      <div className="card">
        <div className="card__body" style={{ padding: 0 }}>
          {loading ? (
            <Loader fullScreen />
          ) : bugs.length > 0 ? (
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
                {bugs.map(bug => (
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
                          <div className="topbar__avatar" style={{ width: 24, height: 24, fontSize: '0.7rem' }}>
                            {bug.assigned_to.first_name?.[0]?.toUpperCase() || bug.assigned_to.username?.[0]?.toUpperCase()}
                          </div>
                          <span style={{ fontSize: '0.82rem' }}>
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
                {bugs.map(bug => (
                  <div
                    key={bug.id}
                    className="bug-card-mobile-item"
                    onClick={() => navigate(`/bug/${bug.id}`)}
                  >
                    <div className="bug-card-mobile-item__top">
                      <div className="bug-card-mobile-item__title">
                        {bug.title}
                      </div>
                      <span className={`badge ${priorityBadges[bug.priority] || 'badge--medium'}`} style={{ flexShrink: 0 }}>
                        {bug.priority}
                      </span>
                    </div>
                    <div className="bug-card-mobile-item__meta">
                      <span className="bug-card-mobile-item__id">{bug.display_id}</span>
                      <span className={`badge ${statusBadges[bug.status] || 'badge--open'}`}>
                        {bug.status}
                      </span>
                      {bug.project_detail && (
                        <span className="bug-card-mobile-item__project">
                          <FolderGit2 size={11} />
                          {bug.project_detail.name}
                        </span>
                      )}
                      {bug.assigned_to && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          → {bug.assigned_to.first_name || bug.assigned_to.username}
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
              <div className="empty-state__title">No bugs match your filters</div>
              <div className="empty-state__desc">Try adjusting your filters or search keywords</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Bugs;
