import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bookmark, Bug as BugIcon, Download, PlusCircle, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useBugEvents } from '../context/NotificationsContext';
import useDebounced from '../hooks/useDebounced';
import { csvCell, errorMessage, fullName, PRIORITIES, STATUSES, unwrap } from '../lib/utils';
import { ConfirmDialog, EmptyState, Modal, PageHead, RowsSkeleton } from '../components/ui';
import IssueList from '../components/IssueList';

const PAGE_SIZE = 25;
const FILTER_KEYS = ['status', 'priority', 'assigned_to', 'project', 'tags', 'mine', 'overdue', 'unassigned'];
const SORTS = [
  { value: '-created_at', label: 'Newest first' },
  { value: 'created_at', label: 'Oldest first' },
  { value: '-updated_at', label: 'Recently updated' },
  { value: '-priority_rank,-created_at', label: 'Highest priority' },
  { value: 'priority_rank,-created_at', label: 'Lowest priority' },
  { value: 'due_date', label: 'Due date' },
];

const Bugs = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [bugs, setBugs] = useState(null);
  const [count, setCount] = useState(0);
  const [people, setPeople] = useState([]);
  const [projects, setProjects] = useState([]);
  const [saved, setSaved] = useState([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [deleteSaved, setDeleteSaved] = useState(null);
  const [exporting, setExporting] = useState(false);
  const requestId = useRef(0);

  const [search, setSearch] = useState(params.get('q') || '');
  const debouncedSearch = useDebounced(search, 300);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const sort = params.get('sort') || '-created_at';
  const role = user?.profile?.role || 'Developer';

  const update = useCallback((changes) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
      if (!('page' in changes)) next.delete('page');
      return next;
    }, { replace: true });
  }, [setParams]);

  useEffect(() => { if ((params.get('q') || '') !== debouncedSearch) update({ q: debouncedSearch }); }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.allSettled([api.get('users/', { params: { page_size: 500 } }), api.get('projects/', { params: { page_size: 500 } }), api.get('filters/')]).then(([u, p, f]) => {
      if (u.status === 'fulfilled') setPeople(unwrap(u.value));
      if (p.status === 'fulfilled') setProjects(unwrap(p.value));
      if (f.status === 'fulfilled') setSaved(unwrap(f.value));
    });
  }, []);

  const query = useMemo(() => {
    const q = { ordering: sort, page_size: PAGE_SIZE, page };
    FILTER_KEYS.forEach((k) => { if (params.get(k)) q[k] = params.get(k); });
    if (params.get('q')) q.search = params.get('q');
    return q;
  }, [params, sort, page]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const res = await api.get('bugs/', { params: query });
      if (id !== requestId.current) return; // a newer request superseded this one
      setBugs(unwrap(res));
      setCount(res.data.count ?? unwrap(res).length);
    } catch (err) {
      if (id !== requestId.current) return;
      if (err.response?.status === 404 && page > 1) { update({ page: '' }); return; } // page past the end
      toast.error(errorMessage(err, 'Could not load bugs.'));
      setBugs((b) => b ?? []);
    }
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useBugEvents(load);

  const activeFilters = FILTER_KEYS.some((k) => params.get(k)) || params.get('q') || sort !== '-created_at';
  const clear = () => { setSearch(''); setParams({}, { replace: true }); };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await api.get('bugs/', { params: { ...query, page: 1, page_size: 500 } });
      const rows = unwrap(res);
      const header = ['ID', 'Title', 'Status', 'Priority', 'Project', 'Reporter', 'Assignee', 'Due date', 'Created'];
      const lines = rows.map((b) => [
        b.display_id, b.title, b.status, b.priority, b.project_detail?.name || 'General', fullName(b.created_by),
        b.assigned_to ? fullName(b.assigned_to) : 'Unassigned', b.due_date || '', b.created_at,
      ].map(csvCell).join(','));
      const blob = new Blob([`﻿${[header.map(csvCell).join(','), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bugs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast.success(`Exported ${rows.length} bug${rows.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Export failed.'));
    } finally {
      setExporting(false);
    }
  };

  const saveFilter = async (e) => {
    e.preventDefault();
    const criteria = Object.fromEntries([...params.entries()].filter(([k]) => k !== 'page'));
    try {
      const res = await api.post('filters/', { name: saveName.trim(), criteria });
      setSaved((s) => [res.data, ...s]);
      setSaveOpen(false);
      setSaveName('');
      toast.success('Filter saved');
    } catch (err) { toast.error(errorMessage(err)); }
  };

  const applySaved = (id) => {
    const f = saved.find((s) => s.id === id);
    if (!f) return;
    setSearch(f.criteria.q || '');
    setParams(new URLSearchParams(f.criteria), { replace: true });
  };

  const removeSaved = async () => {
    try {
      await api.delete(`filters/${deleteSaved.id}/`);
      setSaved((s) => s.filter((f) => f.id !== deleteSaved.id));
      toast.success('Saved filter removed');
    } catch (err) { toast.error(errorMessage(err)); }
    setDeleteSaved(null);
  };

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const select = (key, label, options) => (
    <select className="select" aria-label={label} value={params.get(key) || ''} onChange={(e) => update({ [key]: e.target.value })}>
      <option value="">{label}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <div>
      <PageHead
        title="All bugs"
        subtitle={role === 'Developer' ? 'Bugs assigned to you or filed by you.' : 'Search, filter and triage every bug in your organization.'}
        actions={(
          <>
            <button className="btn btn--secondary" onClick={exportCsv} disabled={exporting || !bugs?.length}><Download size={15} /> {exporting ? 'Exporting…' : 'Export CSV'}</button>
            <Link to="/create" className="btn btn--primary"><PlusCircle size={16} /> Log a bug</Link>
          </>
        )}
      />

      <div className="card toolbar">
        <div className="input-icon">
          <Search size={15} />
          <input className="input" type="search" placeholder="Search title, description or ID…" aria-label="Search bugs" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {select('status', 'Any status', STATUSES.map((s) => [s, s]))}
        {select('priority', 'Any priority', PRIORITIES.map((p) => [p, p]))}
        {select('project', 'Any project', projects.map((p) => [p.id, p.name]))}
        {role !== 'Developer' && select('assigned_to', 'Any assignee', people.map((u) => [u.id, fullName(u)]))}
        <select className="select" aria-label="Sort" value={sort} onChange={(e) => update({ sort: e.target.value === '-created_at' ? '' : e.target.value })}>
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <div className="row row--wrap" style={{ width: '100%' }}>
          {[['mine', 'Assigned to me'], ['unassigned', 'Unassigned'], ['overdue', 'Overdue']].map(([k, label]) => (
            <label key={k} className="check"><input type="checkbox" checked={params.get(k) === 'true'} onChange={(e) => update({ [k]: e.target.checked ? 'true' : '' })} />{label}</label>
          ))}
          <span className="spacer row row--wrap">
            {saved.length > 0 && (
              <>
                <select className="select select--sm" style={{ width: 170 }} aria-label="Saved filters" value="" onChange={(e) => applySaved(e.target.value)}>
                  <option value="">Saved filters…</option>
                  {saved.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <select className="select select--sm" style={{ width: 140 }} aria-label="Delete a saved filter" value="" onChange={(e) => setDeleteSaved(saved.find((f) => f.id === e.target.value))}>
                  <option value="">Delete saved…</option>
                  {saved.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </>
            )}
            <button className="btn btn--ghost btn--sm" onClick={() => setSaveOpen(true)} disabled={!activeFilters}><Bookmark size={14} /> Save filter</button>
            {activeFilters && <button className="btn btn--ghost btn--sm" onClick={clear}><RefreshCw size={14} /> Clear</button>}
          </span>
        </div>
      </div>

      <div className="card card--flush">
        {bugs === null ? <RowsSkeleton /> : bugs.length === 0 ? (
          <EmptyState icon={BugIcon} title={activeFilters ? 'No bugs match these filters' : 'No bugs yet'} action={activeFilters ? <button className="btn btn--secondary" onClick={clear}>Clear filters</button> : <Link to="/create" className="btn btn--primary">Log a bug</Link>}>
            {activeFilters ? 'Try a different search or remove a filter.' : 'Bugs you log will show up here.'}
          </EmptyState>
        ) : (
          <>
            <IssueList bugs={bugs} />
            <div className="pager">
              <span>{(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + bugs.length} of {count}</span>
              <span className="row">
                <button className="btn btn--secondary btn--sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Previous</button>
                <span>Page {page} of {pages}</span>
                <button className="btn btn--secondary btn--sm" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>Next</button>
              </span>
            </div>
          </>
        )}
      </div>

      {saveOpen && (
        <Modal size="sm" title="Save this filter" onClose={() => setSaveOpen(false)}>
          <form onSubmit={saveFilter}>
            <div className="modal__body field">
              <label htmlFor="sf">Name</label>
              <input id="sf" className="input" required maxLength={100} value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="e.g. My critical bugs" />
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--secondary" onClick={() => setSaveOpen(false)}>Cancel</button>
              <button className="btn btn--primary" disabled={!saveName.trim()}>Save</button>
            </div>
          </form>
        </Modal>
      )}
      {deleteSaved && <ConfirmDialog danger title="Delete saved filter" message={`Delete “${deleteSaved.name}”? This cannot be undone.`} confirmLabel="Delete" onConfirm={removeSaved} onCancel={() => setDeleteSaved(null)} />}
    </div>
  );
};

export default Bugs;
