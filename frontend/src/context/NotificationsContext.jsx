import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api, { BASE_URL, tokens } from '../api';
import { unwrap } from '../lib/utils';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext(null);

export const NotificationsProvider = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const listeners = useRef(new Set());

  const load = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        api.get('notifications/', { params: { page_size: 100 } }),
        api.get('notifications/unread_count/'),
      ]);
      setItems(unwrap(list));
      setUnread(count.data.count);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoaded(true);
    }
  }, []);

  const markRead = useCallback(async (id) => {
    let wasUnread = false;
    setItems((prev) => prev.map((n) => {
      if (n.id === id && !n.is_read) { wasUnread = true; return { ...n, is_read: true }; }
      return n;
    }));
    if (wasUnread) setUnread((c) => Math.max(0, c - 1));
    try { await api.post(`notifications/${id}/mark_read/`); } catch { load(); }
  }, [load]);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    try { await api.post('notifications/read_all/'); } catch { load(); }
  }, [load]);

  const subscribeBugEvents = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  useEffect(() => {
    if (!user) {
      setItems([]); setUnread(0); setLoaded(false);
      return undefined;
    }
    load();

    let ws = null;
    let timer = null;
    let attempt = 0;
    let stopped = false;

    const connect = () => {
      const token = tokens.access;
      if (stopped || !token) return;
      ws = new WebSocket(`${BASE_URL.replace(/^http/, 'ws')}/ws/notifications/?token=${encodeURIComponent(token)}`);

      ws.onopen = () => {
        if (attempt > 0) load(); // catch up on anything missed while offline
        attempt = 0;
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'notification') {
            setItems((prev) => (prev.some((n) => n.id === msg.data.id) ? prev : [msg.data, ...prev]));
            setUnread((c) => c + 1);
            toast(msg.data.message, { icon: '🔔' });
          } else if (msg.type === 'bug_event') {
            listeners.current.forEach((fn) => fn(msg.data));
          }
        } catch (err) {
          console.error('Bad websocket message', err);
        }
      };
      ws.onclose = () => {
        if (stopped) return;
        attempt += 1;
        timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)));
      };
    };
    connect();

    return () => {
      stopped = true;
      clearTimeout(timer);
      if (ws) { ws.onclose = null; ws.close(); }
    };
  }, [user?.id, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(
    () => ({ items, unread, loaded, markRead, markAllRead, reload: load, subscribeBugEvents }),
    [items, unread, loaded, markRead, markAllRead, load, subscribeBugEvents],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => useContext(NotificationsContext);

/** Run `handler` (debounced) whenever the server reports that bugs changed. */
// eslint-disable-next-line react-refresh/only-export-components
export function useBugEvents(handler, delay = 400) {
  const { subscribeBugEvents } = useNotifications();
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => {
    let timer = null;
    const off = subscribeBugEvents((event) => {
      clearTimeout(timer);
      timer = setTimeout(() => ref.current(event), delay);
    });
    return () => { off(); clearTimeout(timer); };
  }, [subscribeBugEvents, delay]);
}
