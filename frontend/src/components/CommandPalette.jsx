import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bug, FolderGit2, User, LayoutDashboard, KanbanSquare, ListFilter, Bell, PlusCircle, Users } from 'lucide-react';
import api from '../api';
import useDebounced from '../hooks/useDebounced';
import { unwrap, fullName } from '../lib/utils';

const PAGES = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'All bugs', path: '/bugs', icon: ListFilter },
  { name: 'Board', path: '/board', icon: KanbanSquare },
  { name: 'Projects', path: '/projects', icon: FolderGit2 },
  { name: 'Log a bug', path: '/create', icon: PlusCircle },
  { name: 'Team', path: '/team', icon: Users },
  { name: 'Notifications', path: '/notifications', icon: Bell },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState({ bugs: [], projects: [], users: [] });
  const [selected, setSelected] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const q = useDebounced(query.trim(), 200);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('palette:open', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('palette:open', onOpen); };
  }, []);

  useEffect(() => {
    if (open) { setQuery(''); setRemote({ bugs: [], projects: [], users: [] }); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  useEffect(() => {
    if (!open || !q) { setRemote({ bugs: [], projects: [], users: [] }); return undefined; }
    let cancelled = false;
    const params = { search: q, page_size: 5 };
    Promise.allSettled([api.get('bugs/', { params }), api.get('projects/', { params }), api.get('users/', { params })]).then(([b, p, u]) => {
      if (cancelled) return;
      setRemote({
        bugs: b.status === 'fulfilled' ? unwrap(b.value) : [],
        projects: p.status === 'fulfilled' ? unwrap(p.value) : [],
        users: u.status === 'fulfilled' ? unwrap(u.value) : [],
      });
    });
    return () => { cancelled = true; };
  }, [q, open]);

  const groups = useMemo(() => {
    const lower = query.trim().toLowerCase();
    const pages = PAGES.filter((p) => !lower || p.name.toLowerCase().includes(lower))
      .map((p) => ({ key: p.path, label: p.name, icon: <p.icon size={16} />, path: p.path }));
    return [
      { title: 'Bugs', items: remote.bugs.map((b) => ({ key: b.id, label: b.title, hint: b.display_id, icon: <Bug size={16} />, path: `/bug/${b.id}` })) },
      { title: 'Projects', items: remote.projects.map((p) => ({ key: p.id, label: p.name, hint: p.prefix, icon: <FolderGit2 size={16} />, path: `/project/${p.id}` })) },
      { title: 'People', items: remote.users.map((u) => ({ key: u.id, label: fullName(u), hint: u.profile?.role, icon: <User size={16} />, path: '/team' })) },
      { title: 'Go to', items: pages },
    ].filter((g) => g.items.length);
  }, [remote, query]);

  const flat = groups.flatMap((g) => g.items);
  useEffect(() => { setSelected(0); }, [q, flat.length]);

  const go = (item) => { setOpen(false); navigate(item.path); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => (flat.length ? (s + 1) % flat.length : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => (flat.length ? (s - 1 + flat.length) % flat.length : 0)); }
    else if (e.key === 'Enter' && flat[selected]) { e.preventDefault(); go(flat[selected]); }
  };

  if (!open) return null;
  let index = -1;
  return (
    <div className="modal-scrim" style={{ alignItems: 'start' }} onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <div className="palette__input">
          <Search size={18} />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown} placeholder="Search bugs, projects, people…" aria-label="Search" />
          <span className="kbd">esc</span>
        </div>
        <div className="palette__list" role="listbox">
          {flat.length === 0 && <div className="palette__empty">No results for “{query}”</div>}
          {groups.map((g) => (
            <div key={g.title}>
              <div className="palette__group">{g.title}</div>
              {g.items.map((item) => {
                index += 1;
                const i = index;
                return (
                  <button key={`${g.title}-${item.key}`} role="option" aria-selected={i === selected} className="palette__item" onMouseEnter={() => setSelected(i)} onClick={() => go(item)}>
                    {item.icon}
                    <span className="truncate grow">{item.label}</span>
                    {item.hint && <span className="muted mono" style={{ fontSize: 12 }}>{item.hint}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
