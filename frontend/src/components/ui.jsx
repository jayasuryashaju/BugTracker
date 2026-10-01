import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, X, Calendar, AlertTriangle } from 'lucide-react';
import { avatarColor, initialsOf, fullName, STATUS_CLASS, PRIORITY_CLASS, formatDate, isOverdue } from '../lib/utils';

export const Avatar = ({ user, size = 'md', title }) => {
  if (!user) {
    return <span className={`avatar avatar--${size} avatar--empty`} title={title || 'Unassigned'} aria-label="Unassigned">?</span>;
  }
  return (
    <span className={`avatar avatar--${size}`} style={{ '--hue': avatarColor(user) }} title={title || fullName(user)} aria-hidden="true">
      {initialsOf(user)}
    </span>
  );
};

export const Person = ({ user, size = 'sm', fallback = 'Unassigned' }) => (
  <span className="person">
    <Avatar user={user} size={size} />
    <span className="truncate" style={user ? undefined : { color: 'var(--text-3)' }}>{user ? fullName(user) : fallback}</span>
  </span>
);

export const StatusBadge = ({ status }) => <span className={`badge ${STATUS_CLASS[status] || ''}`}>{status}</span>;
export const PriorityBadge = ({ priority }) => <span className={`badge ${PRIORITY_CLASS[priority] || ''}`}>{priority}</span>;

const ROLE_CLASS = { Admin: 'badge--critical', Manager: 'badge--high', Tester: 'badge--resolved', Developer: 'badge--medium' };
export const RoleBadge = ({ role }) => <span className={`badge badge--plain ${ROLE_CLASS[role] || ''}`}>{role || 'Member'}</span>;

export const TagChip = ({ tag }) => <span className="tag" style={{ '--tag': tag.color }}>{tag.name}</span>;

export const DueDate = ({ bug }) => {
  if (!bug.due_date) return null;
  const overdue = isOverdue(bug);
  return (
    <span className={`due ${overdue ? 'due--overdue' : ''}`} title={overdue ? 'Overdue' : 'Due date'}>
      {overdue ? <AlertTriangle size={12} /> : <Calendar size={12} />}
      {formatDate(bug.due_date, { month: 'short', day: 'numeric' })}
    </span>
  );
};

export const PageHead = ({ title, subtitle, actions, back }) => (
  <div className="page-head">
    <div style={{ minWidth: 0 }}>
      {back && <Link to={back.to} className="back-link"><ArrowLeft size={14} /> {back.label}</Link>}
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
    {actions && <div className="page-head__actions">{actions}</div>}
  </div>
);

export const EmptyState = ({ icon: Icon, title, children, action }) => (
  <div className="empty">
    {Icon && <div className="empty__icon"><Icon size={24} /></div>}
    <h3>{title}</h3>
    {children && <p>{children}</p>}
    {action}
  </div>
);

export const Spinner = () => <span className="spinner" role="status" aria-label="Loading" />;

export const PageLoader = ({ text = 'Loading…' }) => (
  <div className="loading-block"><Spinner /><span>{text}</span></div>
);

export const FullScreenLoader = ({ text }) => (
  <div className="fullscreen-center"><PageLoader text={text} /></div>
);

export const RowsSkeleton = ({ rows = 5 }) => (
  <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }} aria-busy="true">
    {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" style={{ height: 38, opacity: 1 - i * 0.12 }} />)}
  </div>
);

export const Modal = ({ title, onClose, children, footer, size }) => {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const focusable = ref.current?.querySelector('input, select, textarea, button:not([data-close])');
    focusable?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${size === 'sm' ? 'modal--sm' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal__head">
          <h2>{title}</h2>
          <button className="btn btn--ghost btn--icon btn--sm" onClick={onClose} aria-label="Close" data-close><X size={16} /></button>
        </div>
        {children}
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
};

export const ConfirmDialog = ({ title, message, confirmLabel = 'Confirm', danger, busy, onConfirm, onCancel }) => (
  <Modal
    size="sm"
    title={title}
    onClose={onCancel}
    footer={(
      <>
        <button className="btn btn--secondary" onClick={onCancel}>Cancel</button>
        <button className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
      </>
    )}
  >
    <div className="modal__body"><p style={{ color: 'var(--text-2)' }}>{message}</p></div>
  </Modal>
);
