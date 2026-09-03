import Loader from '../components/Loader';
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import {
  ArrowLeft, Download, Send, Calendar, User, FileText, Image as ImageIcon, Video, X, Activity, AlertCircle, Clock, Link as LinkIcon, Reply, MessageSquare
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MarkdownEditor from '../components/MarkdownEditor';

const COMMENT_USER_PALETTES = [
  {
    border: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    lightBg: 'rgba(99, 102, 241, 0.10)',
    text: '#818cf8',
    glow: 'rgba(99, 102, 241, 0.25)',
  },
  {
    border: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    lightBg: 'rgba(16, 185, 129, 0.10)',
    text: '#34d399',
    glow: 'rgba(16, 185, 129, 0.25)',
  },
  {
    border: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    lightBg: 'rgba(245, 158, 11, 0.10)',
    text: '#fbbf24',
    glow: 'rgba(245, 158, 11, 0.25)',
  },
  {
    border: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899, #db2777)',
    lightBg: 'rgba(236, 72, 153, 0.10)',
    text: '#f472b6',
    glow: 'rgba(236, 72, 153, 0.25)',
  },
  {
    border: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d4, #0284c7)',
    lightBg: 'rgba(6, 182, 212, 0.10)',
    text: '#22d3ee',
    glow: 'rgba(6, 182, 212, 0.25)',
  },
  {
    border: '#a855f7',
    gradient: 'linear-gradient(135deg, #a855f7, #7c3aed)',
    lightBg: 'rgba(168, 85, 247, 0.10)',
    text: '#c084fc',
    glow: 'rgba(168, 85, 247, 0.25)',
  },
  {
    border: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316, #ea580c)',
    lightBg: 'rgba(249, 115, 22, 0.10)',
    text: '#fb923c',
    glow: 'rgba(249, 115, 22, 0.25)',
  },
  {
    border: '#14b8a6',
    gradient: 'linear-gradient(135deg, #14b8a6, #0d9488)',
    lightBg: 'rgba(20, 184, 166, 0.10)',
    text: '#2dd4bf',
    glow: 'rgba(20, 184, 166, 0.25)',
  },
];

const getUserPalette = (userObj) => {
  if (!userObj) return COMMENT_USER_PALETTES[0];
  const key = (userObj.username || userObj.email || (typeof userObj === 'string' ? userObj : 'User')).toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COMMENT_USER_PALETTES.length;
  return COMMENT_USER_PALETTES[index];
};

const getRoleBadgeConfig = (role) => {
  switch (role) {
    case 'Admin':
      return { label: 'Admin', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)' };
    case 'Manager':
      return { label: 'Manager', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' };
    case 'Tester':
      return { label: 'Tester', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' };
    case 'Developer':
      return { label: 'Dev', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.3)' };
    default:
      return null;
  }
};

const formatCommentTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMinutes = Math.floor((now - date) / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today at ${timeStr}`;
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${timeStr}`;

  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
};

const statusBadgeClass = (status) => {
  const map = {
    'Open': 'badge--open',
    'In Progress': 'badge--inprogress',
    'Resolved': 'badge--resolved',
    'Closed': 'badge--closed',
  };
  return map[status] || '';
};

const priorityBadgeClass = (priority) => {
  const map = {
    'Low': 'badge--low',
    'Medium': 'badge--medium',
    'High': 'badge--high',
    'Critical': 'badge--critical',
  };
  return map[priority] || '';
};

const BugDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [bug, setBug] = useState(null);
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeMedia, setActiveMedia] = useState(null); // Lightbox modal state
  const [workHours, setWorkHours] = useState('');
  const [workNote, setWorkNote] = useState('');
  const [availableBugs, setAvailableBugs] = useState([]);
  const [selectedLinkBug, setSelectedLinkBug] = useState('');

  const fetchBug = () => {
    api.get(`bugs/${id}/`).then(res => setBug(res.data)).catch(err => console.error(err));
  };

  useEffect(() => { 
    fetchBug(); 
    const handleBugEvent = (e) => {
      if (e.detail?.bug?.id === id) {
        fetchBug();
      }
    };
    window.addEventListener('ws_bug_event', handleBugEvent);
    return () => window.removeEventListener('ws_bug_event', handleBugEvent);
  }, [id]);

  useEffect(() => {
    if (bug) {
      document.title = `${bug.display_id ? `[${bug.display_id}] ` : ''}${bug.title} | BugTracker Pro`;
    }
  }, [bug]);

  const handleStatusChange = async (newStatus) => {
    await api.patch(`bugs/${id}/`, { status: newStatus });
    fetchBug();
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const payload = { bug: id, content: comment };
      if (replyTo) payload.parent = replyTo;
      await api.post('comments/', payload);
      setComment('');
      setReplyTo(null);
      fetchBug();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogWork = async (e) => {
    e.preventDefault();
    if (!workHours) return;
    try {
      await api.post('worklogs/', { bug: id, hours: workHours, note: workNote });
      setWorkHours('');
      setWorkNote('');
      fetchBug();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLinkBug = async () => {
    if (!selectedLinkBug) return;
    try {
      const newLinkedIds = [...bug.linked_bugs_detail.map(b => b.id), selectedLinkBug];
      await api.patch(`bugs/${id}/`, { linked_bug_ids: newLinkedIds });
      setSelectedLinkBug('');
      fetchBug();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (bug && bug.project) {
        api.get(`bugs/?project=${bug.project}`).then(res => setAvailableBugs(res.data.results || res.data)).catch(() => {});
    }
  }, [bug]);

  if (!bug) return <Loader fullScreen />;

  const createdBy = bug.created_by
    ? `${bug.created_by.first_name || ''} ${bug.created_by.last_name || ''}`.trim() || bug.created_by.username
    : 'Unknown';

  const assignedTo = bug.assigned_to
    ? `${bug.assigned_to.first_name || ''} ${bug.assigned_to.last_name || ''}`.trim() || bug.assigned_to.username
    : 'Unassigned';

  const isImage = (filename) => /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(filename);
  const isVideo = (filename) => /\.(mp4|webm|ogg|mov)$/i.test(filename);

  const isOverdue = bug.due_date && new Date(bug.due_date) < new Date(new Date().setHours(0,0,0,0)) && !['Resolved', 'Closed'].includes(bug.status);

  const replyingToAuthor = (() => {
    if (!replyTo || !bug || !bug.comments) return 'thread';
    const allComments = bug.comments.flatMap(c => [c, ...(c.replies || [])]);
    const target = allComments.find(c => c.id === replyTo);
    if (!target) return 'thread';
    return `${target.author?.first_name || ''} ${target.author?.last_name || ''}`.trim() || target.author?.username || 'User';
  })();

  return (
    <div>
      {/* Lightbox Image Preview Modal */}
      {activeMedia && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
          }}
          onClick={() => setActiveMedia(null)}
        >
          <button
            onClick={() => setActiveMedia(null)}
            style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            <X size={28} />
          </button>
          <img
            src={activeMedia}
            alt="Preview"
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {isOverdue && (
        <div style={{ backgroundColor: 'var(--status-critical)', color: 'white', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <AlertCircle size={18} />
          This bug is overdue! Target resolution date was {new Date(bug.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/bugs" className="btn btn--ghost"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="page-header__title">{bug.title}</h1>
            <p className="page-header__subtitle" style={{ fontFamily: "'SF Mono', 'Cascadia Code', monospace" }}>
              {bug.display_id}
            </p>
          </div>
        </div>
        <div className="page-header__actions">
          <select
            className="form-select"
            style={{ width: 'auto', padding: '8px 36px 8px 12px' }}
            value={bug.status}
            onChange={e => handleStatusChange(e.target.value)}
          >
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Detail Layout */}
      <div className="detail-layout">
        {/* Left: Main Content */}
        <div className="flex-col gap-4" style={{ display: 'flex' }}>
          {/* Status & Priority Badges */}
          <div className="flex gap-3 flex-wrap">
            <span className={`badge ${statusBadgeClass(bug.status)}`}>
              <span className="badge__dot"></span> {bug.status}
            </span>
            <span className={`badge ${priorityBadgeClass(bug.priority)}`}>
              {bug.priority} Priority
            </span>
            {bug.tags_detail && bug.tags_detail.map(tag => (
              <span key={tag.id} className="badge" style={{ backgroundColor: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}` }}>
                {tag.name}
              </span>
            ))}
          </div>

          {/* Description */}
          <div className="card">
            <div className="card__header">
              <span className="card__title">Description</span>
            </div>
            <div className="card__body">
              <div className="detail__description markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {bug.description}
                </ReactMarkdown>
              </div>
            </div>
          </div>

          {/* Steps to Reproduce */}
          {bug.steps_to_reproduce && (
            <div className="card">
              <div className="card__header">
                <span className="card__title">Steps to Reproduce</span>
              </div>
              <div className="card__body">
                <div className="detail__description markdown-content" style={{ backgroundColor: 'var(--bg-base)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {bug.steps_to_reproduce}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* User-Friendly Attachments Media Gallery */}
          {bug.attachments && bug.attachments.length > 0 && (
            <div className="card">
              <div className="card__header">
                <span className="card__title">Attachments & Media ({bug.attachments.length})</span>
              </div>
              <div className="card__body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {bug.attachments.map(att => {
                    const fileUrl = att.file.startsWith('http') ? att.file : `http://localhost:8000${att.file}`;
                    const fileName = att.file.split('/').pop();

                    if (isImage(fileName)) {
                      return (
                        <div key={att.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px', background: 'var(--bg-base)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <span className="flex items-center gap-1"><ImageIcon size={14} /> {fileName}</span>
                            <a href={fileUrl} target="_blank" rel="noreferrer" download style={{ color: 'var(--accent)', textDecoration: 'none' }} className="flex items-center gap-1">
                              <Download size={12} /> Download
                            </a>
                          </div>
                          <img
                            src={fileUrl}
                            alt={fileName}
                            onClick={() => setActiveMedia(fileUrl)}
                            style={{ width: '100%', maxHeight: '320px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: '1px solid var(--border)' }}
                          />
                        </div>
                      );
                    } else if (isVideo(fileName)) {
                      return (
                        <div key={att.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px', background: 'var(--bg-base)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <span className="flex items-center gap-1"><Video size={14} /> Screen Recording Video ({fileName})</span>
                            <a href={fileUrl} target="_blank" rel="noreferrer" download style={{ color: 'var(--accent)', textDecoration: 'none' }} className="flex items-center gap-1">
                              <Download size={12} /> Download
                            </a>
                          </div>
                          <video
                            controls
                            src={fileUrl}
                            style={{ width: '100%', maxHeight: '380px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', backgroundColor: '#000' }}
                          />
                        </div>
                      );
                    } else {
                      return (
                        <div key={att.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-base)' }}>
                          <span className="flex items-center gap-2" style={{ fontSize: '0.85rem' }}>
                            <FileText size={16} /> {fileName}
                          </span>
                          <a href={fileUrl} target="_blank" rel="noreferrer" download className="btn btn--secondary btn--sm">
                            <Download size={14} /> Download
                          </a>
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Meta Info */}
          <div className="detail__meta-grid">
            <div className="detail__meta-item">
              <div className="detail__meta-label">Created by</div>
              <div className="detail__meta-value flex items-center gap-2">
                <User size={14} style={{ color: 'var(--text-dim)' }} /> {createdBy}
              </div>
            </div>
            <div className="detail__meta-item">
              <div className="detail__meta-label">Assigned to</div>
              <div className="detail__meta-value flex items-center gap-2">
                <User size={14} style={{ color: 'var(--text-dim)' }} /> {assignedTo}
              </div>
            </div>
            <div className="detail__meta-item">
              <div className="detail__meta-label">Created</div>
              <div className="detail__meta-value flex items-center gap-2">
                <Calendar size={14} style={{ color: 'var(--text-dim)' }} />
                {new Date(bug.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div className="detail__meta-item">
              <div className="detail__meta-label">Target Due Date</div>
              <div className="detail__meta-value flex items-center gap-2">
                <Calendar size={14} style={{ color: 'var(--status-critical)' }} />
                <input 
                  type="date"
                  style={{ background: 'transparent', border: 'none', color: isOverdue ? 'var(--status-critical)' : 'inherit', fontSize: 'inherit', fontFamily: 'inherit', padding: 0, outline: 'none', cursor: 'pointer', fontWeight: isOverdue ? 600 : 'normal' }}
                  value={bug.due_date || ''}
                  onChange={async (e) => {
                    try {
                      await api.patch(`bugs/${bug.id}/`, { due_date: e.target.value || null });
                      fetchBug();
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                />
              </div>
            </div>
            <div className="detail__meta-item">
              <div className="detail__meta-label">Last Updated</div>
              <div className="detail__meta-value flex items-center gap-2">
                <Calendar size={14} style={{ color: 'var(--text-dim)' }} />
                {new Date(bug.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Linked Bugs */}
          <div className="card" style={{ marginTop: '24px' }}>
            <div className="card__header">
              <span className="card__title flex items-center gap-2"><LinkIcon size={16} /> Linked Issues</span>
            </div>
            <div className="card__body">
              {bug.linked_bugs_detail && bug.linked_bugs_detail.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {bug.linked_bugs_detail.map(lb => (
                    <Link key={lb.id} to={`/bugs/${lb.id}`} className="badge" style={{ backgroundColor: 'var(--bg-active)', color: 'var(--text-primary)', border: '1px solid var(--border)', textDecoration: 'none' }}>
                      <span className="badge__dot" style={{ backgroundColor: 'var(--status-open)' }}></span> {lb.title}
                    </Link>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <select className="form-input" style={{ flex: 1, padding: '6px' }} value={selectedLinkBug} onChange={e => setSelectedLinkBug(e.target.value)}>
                  <option value="">Link a related issue...</option>
                  {availableBugs.filter(b => b.id !== bug.id && !bug.linked_bugs_detail?.find(lb => lb.id === b.id)).map(b => (
                    <option key={b.id} value={b.id}>{b.title}</option>
                  ))}
                </select>
                <button type="button" className="btn btn--secondary btn--sm" onClick={handleLinkBug}>Link</button>
              </div>
            </div>
          </div>

          {/* Work Logs */}
          <div className="card" style={{ marginTop: '24px' }}>
            <div className="card__header flex justify-between items-center">
              <span className="card__title flex items-center gap-2"><Clock size={16} /> Time Tracking</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Total: <strong style={{ color: 'var(--text-primary)' }}>{(bug.work_logs?.reduce((sum, log) => sum + parseFloat(log.hours), 0) || 0).toFixed(2)}h</strong>
              </span>
            </div>
            <div className="card__body">
              {bug.work_logs && bug.work_logs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {bug.work_logs.map(log => (
                    <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '8px', backgroundColor: 'var(--bg-base)', borderRadius: 'var(--radius-sm)' }}>
                      <span>
                        <strong>{log.user.username}</strong> logged {log.hours}h
                        {log.note && <span style={{ color: 'var(--text-muted)' }}> - {log.note}</span>}
                      </span>
                      <span style={{ color: 'var(--text-dim)' }}>{new Date(log.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleLogWork} style={{ display: 'flex', gap: '8px' }}>
                <input type="number" step="0.1" min="0.1" className="form-input" placeholder="Hours (e.g. 1.5)" style={{ width: '120px', padding: '6px' }} value={workHours} onChange={e => setWorkHours(e.target.value)} required />
                <input type="text" className="form-input" placeholder="Note (optional)" style={{ flex: 1, padding: '6px' }} value={workNote} onChange={e => setWorkNote(e.target.value)} />
                <button type="submit" className="btn btn--primary btn--sm">Log Time</button>
              </form>
            </div>
          </div>

          {/* Activity Log */}
          {bug.activity_logs && bug.activity_logs.length > 0 && (
            <div className="card" style={{ marginTop: '24px' }}>
              <div className="card__header">
                <span className="card__title flex items-center gap-2" style={{ display: 'flex' }}><Activity size={16} /> Audit Timeline</span>
              </div>
              <div className="card__body">
                <div className="activity-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '16px', borderLeft: '2px solid var(--border)' }}>
                  {bug.activity_logs.map(log => {
                    const actorName = log.actor ? log.actor.username : 'System';
                    return (
                      <div key={log.id} style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '-22.5px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent)', outline: '3px solid var(--bg-surface)' }}></div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{actorName}</span> • {new Date(log.created_at).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.9rem' }}>
                          {log.action}
                          {log.old_value || log.new_value ? (
                            <span style={{ color: 'var(--text-dim)', marginLeft: '8px' }}>
                              ({log.old_value || 'None'} → {log.new_value})
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right: Comments Panel */}
        <div className="card" style={{ position: 'sticky', top: '28px' }}>
          <div className="card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card__title flex items-center gap-2">
              <MessageSquare size={16} style={{ color: 'var(--accent)' }} />
              Comments ({bug.comments?.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0) || 0})
            </span>
          </div>
          <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Comment List */}
            {bug.comments && bug.comments.length > 0 ? (
              <div className="comment-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {bug.comments.map(c => {
                  const renderComment = (commentObj, isReply = false, parentAuthorName = null) => {
                    const authorName = commentObj.author 
                      ? `${commentObj.author.first_name || ''} ${commentObj.author.last_name || ''}`.trim() || commentObj.author.username 
                      : 'Unknown';
                    const authorInitial = (commentObj.author?.first_name?.[0] || commentObj.author?.username?.[0] || authorName[0] || '?').toUpperCase();
                    const isCurrentUser = user && commentObj.author && (commentObj.author.username === user.username || commentObj.author.id === user.id);
                    const palette = getUserPalette(commentObj.author);
                    const roleBadge = getRoleBadgeConfig(commentObj.author?.profile?.role);

                    return (
                      <div key={commentObj.id} style={{ width: '100%' }}>
                        <div 
                          className="comment-card" 
                          style={{
                            borderLeft: `3px solid ${palette.border}`,
                            background: 'var(--bg-elevated)',
                            padding: '12px 14px',
                            borderRadius: 'var(--radius-md)'
                          }}
                        >
                          {/* Sleek Compact Single-Line Header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexWrap: 'wrap' }}>
                              {/* Compact Avatar with distinct color */}
                              <div 
                                style={{
                                  width: '22px', 
                                  height: '22px', 
                                  borderRadius: '50%', 
                                  background: palette.gradient,
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '0.68rem',
                                  flexShrink: 0
                                }}
                              >
                                {authorInitial}
                              </div>

                              {/* Author Name */}
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                                {authorName}
                              </span>
                              
                              {/* You Badge */}
                              {isCurrentUser && (
                                <span className="badge--you" style={{ padding: '1px 5px', fontSize: '0.62rem' }}>You</span>
                              )}

                              {/* Role Badge */}
                              {roleBadge && (
                                <span 
                                  style={{ 
                                    fontSize: '0.62rem', 
                                    fontWeight: 600, 
                                    padding: '1px 5px', 
                                    borderRadius: 'var(--radius-full)', 
                                    background: roleBadge.bg, 
                                    color: roleBadge.color, 
                                    border: `1px solid ${roleBadge.border}` 
                                  }}
                                >
                                  {roleBadge.label}
                                </span>
                              )}

                              {/* Replying indicator if nested */}
                              {isReply && parentAuthorName && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                  ↳ @{parentAuthorName}
                                </span>
                              )}

                              {/* Dot separator & Timestamp */}
                              <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>•</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                {formatCommentTime(commentObj.created_at)}
                              </span>
                            </div>

                            {/* Reply Button */}
                            {!isReply && (
                              <button 
                                type="button" 
                                onClick={() => setReplyTo(commentObj.id)} 
                                className="comment-reply-btn"
                                title="Reply to comment"
                                style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                              >
                                <Reply size={12} /> Reply
                              </button>
                            )}
                          </div>

                          {/* Comment Content (Primary Focus) */}
                          <div className="markdown-content" style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: '1.55' }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {commentObj.content}
                            </ReactMarkdown>
                          </div>
                        </div>

                        {/* Nested Replies */}
                        {commentObj.replies && commentObj.replies.length > 0 && (
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '8px', 
                            width: '100%', 
                            marginTop: '8px',
                            marginLeft: '16px',
                            paddingLeft: '12px',
                            borderLeft: '2px solid var(--border)'
                          }}>
                            {commentObj.replies.map(r => renderComment(r, true, authorName))}
                          </div>
                        )}
                      </div>
                    );
                  };
                  return renderComment(c);
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                No comments yet. Start the conversation.
              </div>
            )}

            {/* Comment Input */}
            <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              {replyTo && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  backgroundColor: 'var(--accent-muted)', 
                  border: '1px solid var(--border-accent)',
                  padding: '8px 12px', 
                  borderRadius: 'var(--radius-md)', 
                  fontSize: '0.82rem', 
                  color: 'var(--text-primary)' 
                }}>
                  <span className="flex items-center gap-2">
                    <Reply size={14} style={{ color: 'var(--accent-hover)' }} />
                    Replying to <strong style={{ color: 'var(--accent-hover)' }}>@{replyingToAuthor}</strong>
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setReplyTo(null)} 
                    className="btn btn--ghost" 
                    style={{ padding: '2px 4px', color: 'var(--text-muted)' }}
                    title="Cancel reply"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <MarkdownEditor
                value={comment}
                onChange={setComment}
                placeholder="Write a comment..."
                minHeight="70px"
              />
              <button type="submit" className="btn btn--primary btn--sm" disabled={submitting || !comment.trim()} style={{ alignSelf: 'flex-end' }}>
                <Send size={14} />
                {submitting ? 'Posting...' : 'Post Comment'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BugDetail;

