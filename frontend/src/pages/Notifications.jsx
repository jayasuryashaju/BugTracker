import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext';
import { fullName, timeAgo } from '../lib/utils';
import { EmptyState, PageHead, RowsSkeleton } from '../components/ui';
import { notifIcon } from '../lib/ui';

const Notifications = () => {
  const { items, unread, loaded, markRead, markAllRead } = useNotifications();
  const [tab, setTab] = useState('all');
  const navigate = useNavigate();
  const shown = useMemo(() => (tab === 'unread' ? items.filter((n) => !n.is_read) : items), [items, tab]);

  const open = (n) => {
    if (!n.is_read) markRead(n.id);
    if (n.bug) navigate(`/bug/${n.bug}`);
  };

  return (
    <div>
      <PageHead title="Notifications" subtitle="Assignments, status changes and comments on your bugs."
        actions={<button className="btn btn--secondary" onClick={markAllRead} disabled={unread === 0}><CheckCheck size={15} /> Mark all read</button>} />
      <div className="segmented" style={{ marginBottom: 16 }}>
        <button aria-pressed={tab === 'all'} onClick={() => setTab('all')}>All</button>
        <button aria-pressed={tab === 'unread'} onClick={() => setTab('unread')}>Unread{unread ? ` (${unread})` : ''}</button>
      </div>
      <div className="card card--flush">
        {!loaded ? <RowsSkeleton /> : shown.length === 0 ? (
          <EmptyState icon={Bell} title={tab === 'unread' ? 'No unread notifications' : 'Nothing yet'}>You&apos;ll be notified when bugs are assigned to you, change status, or get a comment.</EmptyState>
        ) : shown.map((n) => {
          const Icon = notifIcon(n.notification_type);
          return (
            <button key={n.id} className={`notif ${n.is_read ? '' : 'notif--unread'}`} onClick={() => open(n)}>
              <span className="notif__icon"><Icon size={15} /></span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="notif__title" style={{ display: 'block' }}>{n.title}</span>
                <span className="notif__msg" style={{ WebkitLineClamp: 3 }}>{n.message}</span>
                <span className="notif__time" style={{ display: 'block' }}>{n.actor ? `${fullName(n.actor)} · ` : ''}{timeAgo(n.created_at)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Notifications;
