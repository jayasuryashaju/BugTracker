import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, PlusCircle, LogOut, Bell, Users, ListFilter, Check,
  FolderGit2, Building, Sun, Moon, KanbanSquare, Menu, Search, User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { fullName, timeAgo } from '../lib/utils';
import CommandPalette from './CommandPalette';
import { getTheme, notifIcon, openPalette } from '../lib/ui';
import { Avatar } from './ui';
import Logo from './Logo';

const TITLES = [
  ['/bug/', 'Bug'], ['/project/', 'Project'], ['/projects', 'Projects'], ['/bugs', 'All bugs'], ['/board', 'Board'],
  ['/create', 'Log a bug'], ['/team', 'Team'], ['/organization', 'Organization'], ['/notifications', 'Notifications'], ['/profile', 'Profile'],
];

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { items, unread, markRead, markAllRead } = useNotifications();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const popRef = useRef(null);

  // After a first-time Microsoft sign-in, AuthContext asks us to land on the profile page.
  useEffect(() => {
    const dest = sessionStorage.getItem('post_login_path');
    if (dest) { sessionStorage.removeItem('post_login_path'); navigate(dest, { replace: true }); }
  }, [navigate]);

  useEffect(() => { setMenuOpen(false); setBellOpen(false); window.scrollTo(0, 0); }, [pathname]);

  useEffect(() => {
    const match = TITLES.find(([prefix]) => pathname === '/' ? false : pathname.startsWith(prefix));
    document.title = `${pathname === '/' ? 'Dashboard' : match?.[1] || 'BugTracker'} · BugTracker Pro`;
  }, [pathname]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch { /* storage unavailable */ }
  }, [theme]);

  useEffect(() => {
    const onDown = (e) => { if (popRef.current && !popRef.current.contains(e.target)) setBellOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setBellOpen(false); setMenuOpen(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  const role = user?.profile?.role || 'Developer';
  const isAdmin = role === 'Admin' || user?.is_superuser;

  const nav = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/bugs', icon: ListFilter, label: 'All bugs' },
    { to: '/board', icon: KanbanSquare, label: 'Board' },
    { to: '/projects', icon: FolderGit2, label: 'Projects' },
    { to: '/create', icon: PlusCircle, label: 'Log a bug' },
  ];
  const workspace = [
    { to: '/team', icon: Users, label: 'Team' },
    ...(isAdmin ? [{ to: '/organization', icon: Building, label: 'Organization' }] : []),
    { to: '/notifications', icon: Bell, label: 'Notifications', count: unread },
  ];

  const renderLink = (item) => (
    <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
      <item.icon size={17} />
      <span>{item.label}</span>
      {item.count > 0 && <span className="nav-count">{item.count > 99 ? '99+' : item.count}</span>}
    </NavLink>
  );

  const recent = items.filter((n) => !n.is_read).slice(0, 6);
  const openNotification = async (n) => {
    setBellOpen(false);
    markRead(n.id);
    if (n.bug) navigate(`/bug/${n.bug}`);
  };

  return (
    <div className="app">
      <div className="scrim" data-open={menuOpen} onClick={() => setMenuOpen(false)} />
      <aside className="sidebar" data-open={menuOpen} aria-label="Main navigation">
        <div className="sidebar__brand"><Logo size="sm" subtitle={user?.profile?.organization?.name} /></div>
        <nav className="sidebar__nav">
          <div className="sidebar__label">Work</div>
          {nav.map(renderLink)}
          <div className="sidebar__label">Workspace</div>
          {workspace.map(renderLink)}
        </nav>
        <div className="sidebar__foot">
          <NavLink to="/profile" className="nav-link"><UserIcon size={17} /><span>My profile</span></NavLink>
          <button className="nav-link" onClick={logout}><LogOut size={17} /><span>Sign out</span></button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn btn--ghost btn--icon menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Open menu" aria-expanded={menuOpen}><Menu size={19} /></button>
          <button className="search-trigger" onClick={openPalette} aria-label="Search">
            <Search size={15} /><span>Search…</span><span className="kbd">Ctrl K</span>
          </button>
          <div className="top-actions" ref={popRef}>
            <button className="btn btn--ghost btn--icon" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="btn btn--ghost btn--icon" style={{ position: 'relative' }} onClick={() => setBellOpen((v) => !v)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={bellOpen}>
              <Bell size={17} />
              {unread > 0 && <span className="bell-dot">{unread > 9 ? '9+' : unread}</span>}
            </button>
            {bellOpen && (
              <div className="popover" role="dialog" aria-label="Notifications">
                <div className="popover__head">
                  <span>Notifications</span>
                  {unread > 0 && <button className="link" style={{ fontSize: 13 }} onClick={markAllRead}><Check size={13} style={{ verticalAlign: -2 }} /> Mark all read</button>}
                </div>
                <div className="popover__list">
                  {recent.length === 0 && <div className="empty" style={{ padding: 28 }}>You&apos;re all caught up.</div>}
                  {recent.map((n) => {
                    const Icon = notifIcon(n.notification_type);
                    return (
                      <button key={n.id} className="notif notif--unread" onClick={() => openNotification(n)}>
                        <span className="notif__icon"><Icon size={15} /></span>
                        <span style={{ minWidth: 0 }}>
                          <span className="notif__title" style={{ display: 'block', fontSize: 13.5 }}>{n.title}</span>
                          <span className="notif__msg">{n.message}</span>
                          <span className="notif__time" style={{ display: 'block' }}>{timeAgo(n.created_at)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <Link to="/notifications" className="popover__foot">View all notifications</Link>
              </div>
            )}
            <Link to="/profile" className="user-chip" aria-label="My profile">
              <Avatar user={user} size="md" />
              <span className="user-chip__text">
                <div className="user-chip__name">{fullName(user)}</div>
                <div className="user-chip__role">{role}</div>
              </span>
            </Link>
          </div>
        </header>
        <main className="page animate-in" key={pathname.split('/').slice(0, 2).join('/')}>{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
};

export default Layout;
