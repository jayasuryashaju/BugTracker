import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import {
  LayoutDashboard, PlusCircle, User as UserIcon,
  LogOut, ChevronRight, Bell, Users, ListFilter, Check, MessageSquare, AlertCircle, RefreshCw,
  FolderGit2, Building, Sun, Moon, KanbanSquare, Menu, X
} from 'lucide-react';
import CommandPalette from './CommandPalette';
import Logo from './Logo';

const pageTitles = {
  '/': 'Dashboard',
  '/projects': 'Projects',
  '/bugs': 'All Issues',
  '/board': 'Bug Board',
  '/create': 'Log a Bug',
  '/team': 'Team Management',
  '/organization': 'Organization Settings',
  '/notifications': 'Notifications',
  '/profile': 'My Profile',
};

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const popoverRef = useRef(null);

  // Close sidebar when navigating
  useEffect(() => {
    setSidebarOpen(false);
    setShowNotifPopover(false);
  }, [currentPath]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    let title = 'BugTracker Pro';
    if (currentPath.startsWith('/bug/')) {
      title = 'Bug Details | BugTracker Pro';
    } else if (currentPath.startsWith('/project/')) {
      title = 'Project Overview | BugTracker Pro';
    } else if (pageTitles[currentPath]) {
      title = `${pageTitles[currentPath]} | BugTracker Pro`;
    }
    document.title = title;
  }, [currentPath]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const playNotificationChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1); 
      
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.log("Audio play blocked by browser", e);
    }
  };

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;
      try {
        const res = await api.get('notifications/');
        setNotifications(Array.isArray(res.data) ? res.data : res.data.results || []);
      } catch (err) {
        console.error("Failed to fetch notifications", err);
      }
    };

    fetchNotifications();
    
    let ws = null;
    let reconnectTimeout = null;

    const connectWebSocket = () => {
      if (!user) return;
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      if (!token) return;

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const wsBaseUrl = baseUrl.replace(/^http/, 'ws');
      const wsUrl = `${wsBaseUrl}/ws/notifications/?token=${token}`;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'notification') {
            playNotificationChime();
            setNotifications(prev => {
              if (prev.some(n => n.id === data.data.id)) return prev;
              return [data.data, ...prev];
            });
          } else if (data.type === 'bug_event') {
            window.dispatchEvent(new CustomEvent('ws_bug_event', { detail: data.data }));
          }
        } catch (e) {
          console.error("WebSocket message error", e);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket closed. Reconnecting in 5s...");
        reconnectTimeout = setTimeout(connectWebSocket, 5000);
      };
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [user]);

  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.is_read).length);
  }, [notifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setShowNotifPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id, bugId) => {
    try {
      await api.post(`notifications/${id}/mark_read/`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      setShowNotifPopover(false);
      if (bugId) navigate(`/bug/${bugId}`);
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('notifications/read_all/');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const isBugDetail = currentPath.startsWith('/bug/');
  const pageTitle = isBugDetail ? 'Bug Details' : (pageTitles[currentPath] || 'Dashboard');

  const role = user?.profile?.role || 'Developer';
  const isAdmin = role === 'Admin' || user?.is_superuser;
  const isManagerOrAdmin = isAdmin || role === 'Manager';
  const isAdminOrTester = isManagerOrAdmin || role === 'Tester';

  const navItems = [
    { to: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { to: '/projects', icon: <FolderGit2 size={18} />, label: 'Projects' },
    { to: '/bugs', icon: <ListFilter size={18} />, label: 'All Bugs' },
    { to: '/board', icon: <KanbanSquare size={18} />, label: 'Bug Board' },
  ];

  if (isAdminOrTester) {
    navItems.push({ to: '/create', icon: <PlusCircle size={18} />, label: 'Log a Bug' });
  }

  navItems.push({ to: '/team', icon: <Users size={18} />, label: 'Team Members' });

  if (isAdmin) {
    navItems.push({ to: '/organization', icon: <Building size={18} />, label: 'Org Settings' });
  }

  navItems.push({ to: '/notifications', icon: <Bell size={18} />, label: 'Notifications', badge: unreadCount });

  const userInitial = user?.first_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || '?';
  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`
    : user?.username;

  const getNotifIcon = (type) => {
    switch (type) {
      case 'Assigned': return <AlertCircle size={15} style={{ color: 'var(--status-open)' }} />;
      case 'StatusChanged': return <RefreshCw size={15} style={{ color: 'var(--status-progress)' }} />;
      case 'Commented': return <MessageSquare size={15} style={{ color: 'var(--accent)' }} />;
      default: return <Bell size={15} />;
    }
  };

  return (
    <div className="app-shell">
      {/* ===== SIDEBAR ===== */}
      {/* Sidebar overlay (mobile backdrop) */}
      <div
        className="sidebar-overlay"
        data-open={sidebarOpen ? 'true' : 'false'}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <aside className="sidebar" data-open={sidebarOpen ? 'true' : 'false'}>
        <div className="sidebar__brand" style={{ padding: '0 16px' }}>
          <Logo 
            size="sm" 
            showText={true} 
            subtitle={user?.profile?.organization?.name || 'Workspace'} 
          />
        </div>

        <nav className="sidebar__nav">
          <div className="sidebar__section-label">Navigation</div>
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`sidebar__link ${currentPath === item.to ? 'sidebar__link--active' : ''}`}
            >
              {item.icon}
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge > 0 && (
                <span className="badge badge--critical" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                  {item.badge}
                </span>
              )}
            </Link>
          ))}

          <div className="sidebar__section-label" style={{ marginTop: '12px' }}>Account</div>
          <Link
            to="/profile"
            className={`sidebar__link ${currentPath === '/profile' ? 'sidebar__link--active' : ''}`}
          >
            <UserIcon size={18} />
            My Profile
          </Link>
        </nav>

        <div className="sidebar__footer">
          <button
            onClick={logout}
            className="sidebar__link"
            style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ===== MAIN AREA ===== */}
      <div className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar__left">
            {/* Hamburger (mobile only) */}
            <button
              className="topbar__menu-btn"
              onClick={() => setSidebarOpen(prev => !prev)}
              aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            >
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <span className="topbar__breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
              <span style={{ color: 'var(--text-muted)' }}>BugTracker</span>
              <ChevronRight size={13} style={{ color: 'var(--text-dim)' }} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pageTitle}</span>
            </span>
          </div>
          <div className="topbar__right" style={{ position: 'relative' }} ref={popoverRef}>
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="btn btn--ghost"
              style={{ padding: '8px' }}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun size={18} style={{ color: '#f59e0b' }} /> : <Moon size={18} style={{ color: '#6366f1' }} />}
            </button>

            {/* Notification Bell Button */}
            <button
              onClick={() => setShowNotifPopover(!showNotifPopover)}
              className="btn btn--ghost"
              style={{ position: 'relative', padding: '8px' }}
              title="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '9px',
                    height: '9px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent)',
                    border: '2px solid var(--bg-surface)'
                  }}
                />
              )}
            </button>

            {/* Notification Popover Panel */}
            {showNotifPopover && (
              <div
                className="notif-popover animate-in"
                style={{
                  position: 'absolute',
                  top: '48px',
                  right: '0',
                  width: '340px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 1000,
                  overflow: 'hidden'
                }}
              >
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Check size={12} /> Mark all read
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {notifications.filter(n => !n.is_read).length > 0 ? (
                    notifications.filter(n => !n.is_read).slice(0, 5).map(n => (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id, n.bug)}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                          display: 'flex',
                          gap: '10px',
                          backgroundColor: n.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.06)',
                          transition: 'background var(--transition-fast)'
                        }}
                      >
                        <div style={{ marginTop: '2px' }}>{getNotifIcon(n.notification_type)}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: n.is_read ? 500 : 700, color: 'var(--text-primary)' }}>{n.title}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {n.message}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      No notifications
                    </div>
                  )}
                </div>

                <Link
                  to="/notifications"
                  onClick={() => setShowNotifPopover(false)}
                  style={{
                    display: 'block',
                    padding: '10px',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-base)',
                    color: 'var(--accent)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    borderTop: '1px solid var(--border)'
                  }}
                >
                  View All Notifications →
                </Link>
              </div>
            )}

            {/* Profile Avatar Badge */}
            <Link to="/profile" className="topbar__user">
              <div className="topbar__avatar">{userInitial}</div>
              <div className="topbar__user-info">
                <span className="topbar__user-name">{displayName}</span>
                <span className="topbar__user-role">
                  <span className={`badge ${role === 'Admin' ? 'badge--critical' : role === 'Manager' || role === 'Tester' ? 'badge--inprogress' : 'badge--open'}`} style={{ padding: '1px 6px', fontSize: '0.65rem' }}>
                    {role}
                  </span>
                </span>
              </div>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <div className="content">
          <div className="content__inner animate-in">
            {children}
          </div>
        </div>
      </div>
      <CommandPalette />
    </div>
  );
};

export default Layout;
