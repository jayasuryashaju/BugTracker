import Loader from '../components/Loader';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Bell, CheckCheck, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchNotifications = () => {
    api.get('notifications/').then(res => {
      setNotifications(Array.isArray(res.data) ? res.data : res.data.results || []);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id, bugId) => {
    try {
      await api.post(`notifications/${id}/mark_read/`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      if (bugId) navigate(`/bug/${bugId}`);
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('notifications/read_all/');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'Assigned': return <AlertCircle size={18} style={{ color: 'var(--status-open)' }} />;
      case 'StatusChanged': return <RefreshCw size={18} style={{ color: 'var(--status-progress)' }} />;
      case 'Commented': return <MessageSquare size={18} style={{ color: 'var(--accent)' }} />;
      default: return <Bell size={18} />;
    }
  };

  if (loading) return <Loader fullScreen />;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Notifications</h1>
          <p className="page-header__subtitle">Stay updated on bug assignments, status changes, and comments</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn btn--secondary">
            <CheckCheck size={16} /> Mark all as read
          </button>
        )}
      </div>

      <div className="card">
        <div className="card__body" style={{ padding: 0 }}>
          {notifications.length > 0 ? (
            <div className="flex-col">
              {notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id, n.bug)}
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    cursor: 'pointer',
                    backgroundColor: n.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.05)',
                    transition: 'background var(--transition-fast)'
                  }}
                  className="notification-item"
                >
                  <div style={{ marginTop: '2px' }}>{getIcon(n.notification_type)}</div>
                  <div style={{ flex: 1 }}>
                    <div className="flex justify-between items-center mb-1">
                      <span style={{ fontWeight: n.is_read ? 500 : 700, fontSize: '0.9rem' }}>{n.title}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        {new Date(n.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>{n.message}</p>
                    {n.actor && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', display: 'inline-block' }}>
                        By {n.actor.first_name || n.actor.username}
                      </span>
                    )}
                  </div>
                  {!n.is_read && (
                    <span className="badge__dot" style={{ backgroundColor: 'var(--accent)', marginTop: '6px' }}></span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon"><Bell size={28} /></div>
              <div className="empty-state__title">No notifications yet</div>
              <div className="empty-state__desc">You'll get notified when bugs are assigned or updated</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;
