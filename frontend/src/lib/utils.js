export const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
export const ROLES = ['Admin', 'Manager', 'Tester', 'Developer'];

export const STATUS_CLASS = {
  Open: 'badge--open',
  'In Progress': 'badge--inprogress',
  Resolved: 'badge--resolved',
  Closed: 'badge--closed',
};
export const PRIORITY_CLASS = {
  Low: 'badge--low',
  Medium: 'badge--medium',
  High: 'badge--high',
  Critical: 'badge--critical',
};

/** Normalise paginated and plain-array API responses into an array. */
export const unwrap = (res) => (Array.isArray(res.data) ? res.data : res.data?.results ?? []);

export const fullName = (u) => {
  if (!u) return '';
  const name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
  return name || u.username || u.email || '';
};

export const initialsOf = (u) => {
  const name = fullName(u);
  if (!name) return '?';
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
};

const AVATAR_HUES = ['#4f46e5', '#0e8f68', '#c2570c', '#c0327a', '#0a7ea4', '#7c3aed', '#b45309', '#0f766e'];
export const avatarColor = (u) => {
  const key = String(u?.username || u?.email || u?.id || '');
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
};

/** Turn an axios error (DRF shapes included) into one readable sentence. */
export const errorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  const data = err?.response?.data;
  if (!err?.response) return err?.message === 'Network Error' ? 'Cannot reach the server. Check your connection.' : fallback;
  if (typeof data === 'string') return data.length < 200 ? data : fallback;
  if (!data || typeof data !== 'object') return fallback;
  if (data.detail) return String(data.detail);
  if (data.error) return Array.isArray(data.error) ? data.error.join(' ') : String(data.error);
  const flatten = (value) => {
    if (Array.isArray(value)) return flatten(value[0]);
    if (value && typeof value === 'object') return flatten(Object.values(value)[0]);
    return value ? String(value) : '';
  };
  const [key, value] = Object.entries(data)[0] || [];
  const msg = flatten(value);
  if (!msg) return fallback;
  return key === 'non_field_errors' ? msg : `${key.replace(/_/g, ' ')}: ${msg}`;
};

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const fileUrl = (path) => (!path ? '' : /^https?:/.test(path) ? path : `${API_BASE}${path}`);

export const formatDate = (value, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  if (!value) return '';
  // Bare dates (YYYY-MM-DD) must not shift a day in timezones behind UTC.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', opts);
};

export const timeAgo = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.round(diff / 86400)}d ago`;
  return formatDate(value, { month: 'short', day: 'numeric', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};

export const isOverdue = (bug) => {
  if (!bug?.due_date || ['Resolved', 'Closed'].includes(bug.status)) return false;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return bug.due_date < todayKey;
};

/** Neutralise spreadsheet formula injection in CSV cells. */
export const csvCell = (value) => {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
