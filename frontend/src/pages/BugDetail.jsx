import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, Clock, Link2, MessageSquare, Pencil, Reply, Send, Trash2, X, Activity as ActivityIcon, Paperclip,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useBugEvents } from '../context/NotificationsContext';
import { errorMessage, formatDate, fullName, isOverdue, PRIORITIES, STATUSES, timeAgo, unwrap } from '../lib/utils';
import MarkdownEditor, { Markdown } from '../components/MarkdownEditor';
import { MediaPicker, AttachmentGallery } from '../components/Media';
import { Avatar, ConfirmDialog, EmptyState, PageLoader, PriorityBadge, RoleBadge, StatusBadge } from '../components/ui';

const Card = ({ icon: Icon, title, extra, children }) => (
  <section className="card">
    <div className="card__head">{Icon && <Icon size={16} style={{ color: 'var(--text-3)' }} />}<h2>{title}</h2>{extra && <span className="spacer muted">{extra}</span>}</div>
    <div className="card__body">{children}</div>
  </section>
);

const Prop = ({ label, children }) => <div className="prop"><span>{label}</span><div style={{ minWidth: 0 }}>{children}</div></div>;

/* ---------- comments ---------- */
const CommentItem = ({ comment, me, canModerate, depth, onReply, onChanged }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.content);
  const [confirm, setConfirm] = useState(false);
  const mine = comment.author?.id === me.id;

  const save = async () => {
    try {
      await api.patch(`comments/${comment.id}/`, { content: text });
      setEditing(false);
      onChanged();
    } catch (err) { toast.error(errorMessage(err)); }
  };
  const remove = async () => {
    try { await api.delete(`comments/${comment.id}/`); onChanged(); } catch (err) { toast.error(errorMessage(err)); }
    setConfirm(false);
  };

  return (
    <div>
      <div className="comment">
        <Avatar user={comment.author} size="md" />
        <div className="comment__body">
          <div className="comment__meta">
            <b>{fullName(comment.author) || 'Unknown'}</b>
            {mine && <span className="badge badge--accent badge--plain">You</span>}
            {comment.author?.profile?.role && <RoleBadge role={comment.author.profile.role} />}
            <span className="muted" title={new Date(comment.created_at).toLocaleString()}>{timeAgo(comment.created_at)}</span>
            <span className="comment__actions">
              {depth === 0 && <button className="btn btn--ghost btn--sm" onClick={() => onReply(comment)}><Reply size={13} /> Reply</button>}
              {(mine || canModerate) && !editing && (
                <>
                  {mine && <button className="btn btn--ghost btn--icon btn--sm" aria-label="Edit comment" onClick={() => setEditing(true)}><Pencil size={13} /></button>}
                  <button className="btn btn--ghost btn--icon btn--sm" aria-label="Delete comment" onClick={() => setConfirm(true)}><Trash2 size={13} /></button>
                </>
              )}
            </span>
          </div>
          {editing ? (
            <div className="stack" style={{ gap: 8 }}>
              <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus />
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn--secondary btn--sm" onClick={() => { setEditing(false); setText(comment.content); }}>Cancel</button>
                <button className="btn btn--primary btn--sm" disabled={!text.trim()} onClick={save}>Save</button>
              </div>
            </div>
          ) : <Markdown>{comment.content}</Markdown>}
        </div>
      </div>
      {comment.replies?.length > 0 && (
        <div className="replies">
          {comment.replies.map((r) => (
            <CommentItem key={r.id} comment={r} me={me} canModerate={canModerate} depth={depth + 1} onReply={onReply} onChanged={onChanged} />
          ))}
        </div>
      )}
      {confirm && <ConfirmDialog danger title="Delete comment" message="This comment (and its replies) will be permanently removed." confirmLabel="Delete" onConfirm={remove} onCancel={() => setConfirm(false)} />}
    </div>
  );
};

/* ---------- page ---------- */
const BugDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bug, setBug] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [people, setPeople] = useState([]);
  const [projects, setProjects] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [title, setTitle] = useState('');
  const [editDesc, setEditDesc] = useState(false);
  const [descDraft, setDescDraft] = useState({ description: '', steps: '' });
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [posting, setPosting] = useState(false);
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [linkQuery, setLinkQuery] = useState('');
  const [linkResults, setLinkResults] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [tagPicker, setTagPicker] = useState(false);
  const titleRef = useRef(null);

  const role = user?.profile?.role;
  const isManager = role === 'Admin' || role === 'Manager' || user?.is_superuser;
  const canEdit = bug && (isManager || role === 'Tester' || bug.created_by?.id === user.id || bug.assigned_to?.id === user.id);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`bugs/${id}/`);
      setBug(res.data);
      setTitle((t) => (document.activeElement?.id === 'bug-title' ? t : res.data.title));
      setNotFound(false);
    } catch (err) {
      if (err.response?.status === 404) setNotFound(true);
      else toast.error(errorMessage(err, 'Could not load this bug.'));
    }
  }, [id]);

  useEffect(() => { setBug(null); load(); }, [load]);
  useBugEvents((event) => { if (event.bug?.id === id) load(); });

  useEffect(() => {
    Promise.allSettled([api.get('users/', { params: { page_size: 500 } }), api.get('projects/', { params: { page_size: 500 } }), api.get('tags/')]).then(([u, p, t]) => {
      if (u.status === 'fulfilled') setPeople(unwrap(u.value));
      if (p.status === 'fulfilled') setProjects(unwrap(p.value));
      if (t.status === 'fulfilled') setAllTags(unwrap(t.value));
    });
  }, []);

  useEffect(() => { if (bug) document.title = `${bug.display_id} ${bug.title} · BugTracker Pro`; }, [bug?.display_id, bug?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  // Linked-issue search
  useEffect(() => {
    if (linkQuery.trim().length < 2) { setLinkResults([]); return undefined; }
    const timer = setTimeout(() => {
      api.get('bugs/', { params: { search: linkQuery.trim(), page_size: 8 } }).then((res) => setLinkResults(unwrap(res))).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [linkQuery]);

  const patch = async (changes, success) => {
    try {
      const res = await api.patch(`bugs/${id}/`, changes);
      setBug(res.data);
      if (success) toast.success(success);
      return true;
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save that change.'));
      load();
      return false;
    }
  };

  // The title is a textarea that grows with its content so long titles wrap instead of clipping.
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [title, bug?.id]);

  const saveTitle = async () => {
    const next = title.trim();
    if (!next) { setTitle(bug.title); return; }
    if (next !== bug.title) await patch({ title: next });
  };

  const saveDescription = async () => {
    const ok = await patch({ description: descDraft.description, steps_to_reproduce: descDraft.steps }, 'Saved');
    if (ok) setEditDesc(false);
  };

  const postComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setPosting(true);
    try {
      await api.post('comments/', { bug: id, content: comment, ...(replyTo ? { parent: replyTo.id } : {}) });
      setComment('');
      setReplyTo(null);
      await load();
    } catch (err) { toast.error(errorMessage(err)); }
    setPosting(false);
  };

  const logWork = async (e) => {
    e.preventDefault();
    try {
      await api.post('worklogs/', { bug: id, hours, note });
      setHours(''); setNote('');
      load();
    } catch (err) { toast.error(errorMessage(err)); }
  };

  const removeWork = async (logId) => {
    try { await api.delete(`worklogs/${logId}/`); load(); } catch (err) { toast.error(errorMessage(err)); }
  };

  const setLinks = async (ids) => { const ok = await patch({ linked_bug_ids: ids }); if (ok) { setLinkQuery(''); setLinkResults([]); } };

  // Files start uploading as soon as they are picked, dropped or pasted; progress is shown per file.
  const upload = async (added) => {
    const batch = added.map((file) => ({ file, id: `${file.name}-${file.size}-${Math.random()}`, progress: 0 }));
    setUploads((u) => [...u, ...batch]);
    const patchItem = (itemId, changes) => setUploads((u) => u.map((x) => (x.id === itemId ? { ...x, ...changes } : x)));
    await Promise.all(batch.map(async (item) => {
      const body = new FormData();
      body.append('bug', id);
      body.append('file', item.file);
      try {
        await api.post('attachments/', body, { onUploadProgress: (e) => patchItem(item.id, { progress: Math.round((e.loaded / (e.total || e.loaded || 1)) * 100) }) });
        setUploads((u) => u.filter((x) => x.id !== item.id));
      } catch (err) {
        patchItem(item.id, { error: errorMessage(err, 'Upload failed'), progress: null });
      }
    }));
    load();
  };

  const removeAttachment = async (att) => {
    try { await api.delete(`attachments/${att.id}/`); load(); } catch (err) { toast.error(errorMessage(err)); }
  };

  const removeBug = async () => {
    try {
      await api.delete(`bugs/${id}/`);
      toast.success('Bug deleted');
      navigate('/bugs', { replace: true });
    } catch (err) { toast.error(errorMessage(err)); setConfirmDelete(false); }
  };

  const totalHours = useMemo(() => (bug?.work_logs || []).reduce((sum, l) => sum + Number(l.hours), 0), [bug]);
  const commentCount = useMemo(() => {
    const count = (list) => list.reduce((n, c) => n + 1 + count(c.replies || []), 0);
    return count(bug?.comments || []);
  }, [bug]);

  if (notFound) return <EmptyState icon={AlertTriangle} title="Bug not found" action={<Link to="/bugs" className="btn btn--primary">Back to all bugs</Link>}>It may have been deleted, or you may not have access to it.</EmptyState>;
  if (!bug) return <PageLoader />;

  const overdue = isOverdue(bug);
  const linkedIds = bug.linked_bugs_detail.map((b) => b.id);

  return (
    <div>
      <Link to="/bugs" className="back-link">← All bugs</Link>
      {overdue && <div className="overdue-banner"><AlertTriangle size={18} />Overdue — the target date was {formatDate(bug.due_date)}.</div>}

      <div style={{ marginBottom: 20 }}>
        <div className="row" style={{ marginBottom: 4 }}>
          <span className="issue__id" style={{ fontSize: 13 }}>{bug.display_id}</span>
          <StatusBadge status={bug.status} /><PriorityBadge priority={bug.priority} />
        </div>
        {canEdit ? (
          <textarea id="bug-title" ref={titleRef} rows={1} className="title-edit" value={title} maxLength={255} aria-label="Title" onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } if (e.key === 'Escape') { setTitle(bug.title); e.currentTarget.blur(); } }} />
        ) : <h1>{bug.title}</h1>}
      </div>

      <div className="detail">
        <div className="stack detail__main">
          <Card title="Description" extra={canEdit && !editDesc && <button className="btn btn--ghost btn--sm" onClick={() => { setDescDraft({ description: bug.description, steps: bug.steps_to_reproduce || '' }); setEditDesc(true); }}><Pencil size={13} /> Edit</button>}>
            {editDesc ? (
              <div className="stack" style={{ gap: 14 }}>
                <MarkdownEditor value={descDraft.description} onChange={(v) => setDescDraft((d) => ({ ...d, description: v }))} />
                <div className="field"><label>Steps to reproduce</label><MarkdownEditor rows={4} value={descDraft.steps} onChange={(v) => setDescDraft((d) => ({ ...d, steps: v }))} /></div>
                <div className="form-actions" style={{ padding: 0 }}>
                  <button className="btn btn--secondary" onClick={() => setEditDesc(false)}>Cancel</button>
                  <button className="btn btn--primary" disabled={!descDraft.description.trim()} onClick={saveDescription}>Save</button>
                </div>
              </div>
            ) : (
              <>
                <Markdown>{bug.description}</Markdown>
                {bug.steps_to_reproduce && (<><hr className="divider" style={{ margin: '16px 0' }} /><div className="label" style={{ marginBottom: 8 }}>Steps to reproduce</div><Markdown>{bug.steps_to_reproduce}</Markdown></>)}
              </>
            )}
          </Card>

          <Card icon={Paperclip} title={`Screenshots & recordings${bug.attachments.length ? ` (${bug.attachments.length})` : ''}`}>
            <div className="stack" style={{ gap: 14 }}>
              {bug.attachments.length > 0 && (
                <AttachmentGallery attachments={bug.attachments} onDelete={removeAttachment}
                  canDelete={(a) => isManager || a.uploaded_by?.id === user.id} />
              )}
              <MediaPicker compact items={uploads} onAdd={upload} onRemove={(i) => setUploads((u) => u.filter((_, j) => j !== i))} />
            </div>
          </Card>

          <Card icon={MessageSquare} title={`Discussion${commentCount ? ` (${commentCount})` : ''}`}>
            <div className="stack" style={{ gap: 14 }}>
              {bug.comments.length === 0 && <p className="muted">No comments yet. Start the conversation.</p>}
              {bug.comments.map((c) => (
                <CommentItem key={c.id} comment={c} me={user} canModerate={role === 'Admin' || Boolean(user.is_superuser)} depth={0} onReply={(target) => { setReplyTo(target); document.getElementById('comment-box')?.scrollIntoView({ block: 'center' }); }} onChanged={load} />
              ))}
              <form onSubmit={postComment} className="stack" style={{ gap: 8, borderTop: '1px solid var(--border)', paddingTop: 16 }} id="comment-box">
                {replyTo && (
                  <div className="alert alert--info" style={{ alignItems: 'center' }}>
                    <Reply size={14} /><span className="grow">Replying to <b>{fullName(replyTo.author)}</b></span>
                    <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X size={14} /></button>
                  </div>
                )}
                <MarkdownEditor value={comment} onChange={setComment} rows={3} placeholder="Write a comment…" />
                <button className="btn btn--primary" style={{ alignSelf: 'flex-end' }} disabled={posting || !comment.trim()}><Send size={14} /> {posting ? 'Posting…' : 'Comment'}</button>
              </form>
            </div>
          </Card>

          <Card icon={ActivityIcon} title="Activity">
            <ul className="timeline">
              {bug.activity_logs.map((log) => (
                <li key={log.id}>
                  <b>{fullName(log.actor) || 'System'}</b> {log.action.toLowerCase()}
                  {(log.old_value || log.new_value) && log.action !== 'Created' && <span className="muted"> — {log.old_value || 'none'} → {log.new_value || 'none'}</span>}
                  <span className="muted"> · {timeAgo(log.created_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <aside className="detail__side">
          <section className="card detail__props"><div className="card__body">
            <Prop label="Status">
              <select className="select select--sm" disabled={!canEdit} value={bug.status} onChange={(e) => patch({ status: e.target.value })} aria-label="Status">{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            </Prop>
            <Prop label="Priority">
              <select className="select select--sm" disabled={!canEdit} value={bug.priority} onChange={(e) => patch({ priority: e.target.value })} aria-label="Priority">{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
            </Prop>
            <Prop label="Assignee">
              <select className="select select--sm" disabled={!canEdit} value={bug.assigned_to?.id || ''} onChange={(e) => patch({ assigned_to_id: e.target.value || null })} aria-label="Assignee">
                <option value="">Unassigned</option>
                {people.map((u) => <option key={u.id} value={u.id}>{fullName(u)}</option>)}
              </select>
            </Prop>
            <Prop label="Project">
              <select className="select select--sm" disabled={!canEdit} value={bug.project || ''} onChange={(e) => patch({ project: e.target.value || null })} aria-label="Project">
                <option value="">None</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Prop>
            <Prop label="Due date">
              <div className="row">
                <input type="date" className="input input--sm" disabled={!canEdit} value={bug.due_date || ''} onChange={(e) => patch({ due_date: e.target.value || null })} aria-label="Due date" style={overdue ? { color: 'var(--danger)', fontWeight: 600 } : undefined} />
              </div>
            </Prop>
            <Prop label="Tags">
              <div className="row row--wrap" style={{ gap: 6 }}>
                {bug.tags_detail.length === 0 && !tagPicker && <span className="muted">None</span>}
                {(tagPicker ? allTags : bug.tags_detail).map((t) => {
                  const on = bug.tags_detail.some((x) => x.id === t.id);
                  return (
                    <button key={t.id} type="button" className="tag" aria-pressed={on} disabled={!canEdit || !tagPicker} style={{ '--tag': t.color, cursor: tagPicker ? 'pointer' : 'default', opacity: on ? 1 : 0.5 }}
                      onClick={() => patch({ tag_ids: on ? bug.tags_detail.filter((x) => x.id !== t.id).map((x) => x.id) : [...bug.tags_detail.map((x) => x.id), t.id] })}>{t.name}</button>
                  );
                })}
                {canEdit && allTags.length > 0 && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setTagPicker((v) => !v)}>{tagPicker ? 'Done' : bug.tags_detail.length ? 'Edit' : '+ Add tag'}</button>
                )}
              </div>
            </Prop>
            <Prop label="Reporter"><span className="person"><Avatar user={bug.created_by} size="sm" />{fullName(bug.created_by)}</span></Prop>
            <Prop label="Created"><span title={new Date(bug.created_at).toLocaleString()}>{formatDate(bug.created_at)}</span></Prop>
            <Prop label="Updated"><span title={new Date(bug.updated_at).toLocaleString()}>{timeAgo(bug.updated_at)}</span></Prop>
          </div></section>

          <div className="detail__rest stack">
          <Card icon={Clock} title="Time tracking" extra={`${totalHours.toFixed(2).replace(/\.?0+$/, '')}h logged`}>
            <div className="stack" style={{ gap: 8 }}>
              {bug.work_logs.map((l) => (
                <div key={l.id} className="row" style={{ alignItems: 'flex-start' }}>
                  <div className="grow"><b>{Number(l.hours)}h</b> <span className="muted">by {fullName(l.user)} · {timeAgo(l.created_at)}</span>{l.note && <div style={{ color: 'var(--text-2)' }}>{l.note}</div>}</div>
                  {(l.user?.id === user.id || user.profile?.role === 'Admin') && <button className="btn btn--ghost btn--icon btn--sm" aria-label="Delete time entry" onClick={() => removeWork(l.id)}><Trash2 size={13} /></button>}
                </div>
              ))}
              <form onSubmit={logWork} className="row" style={{ marginTop: 4 }}>
                <input className="input input--sm" type="number" step="0.25" min="0.25" max="999" required placeholder="Hours" aria-label="Hours" style={{ width: 80 }} value={hours} onChange={(e) => setHours(e.target.value)} />
                <input className="input input--sm" placeholder="Note (optional)" aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn btn--secondary btn--sm">Log</button>
              </form>
            </div>
          </Card>

          <Card icon={Link2} title="Linked issues">
            <div className="stack" style={{ gap: 8 }}>
              {bug.linked_bugs_detail.map((b) => (
                <div key={b.id} className="row">
                  <Link to={`/bug/${b.id}`} className="grow truncate" style={{ color: 'var(--accent-text)' }}><span className="issue__id">{b.display_id}</span> {b.title}</Link>
                  <StatusBadge status={b.status} />
                  {canEdit && <button className="btn btn--ghost btn--icon btn--sm" aria-label={`Unlink ${b.display_id}`} onClick={() => setLinks(linkedIds.filter((x) => x !== b.id))}><X size={14} /></button>}
                </div>
              ))}
              {canEdit && (
                <div style={{ position: 'relative' }}>
                  <input className="input input--sm" placeholder="Link another bug — search by title or ID" aria-label="Search bugs to link" value={linkQuery} onChange={(e) => setLinkQuery(e.target.value)} />
                  {linkResults.length > 0 && (
                    <div className="popover" style={{ left: 0, right: 0, width: 'auto', top: 'calc(100% + 4px)' }}>
                      {linkResults.filter((b) => b.id !== bug.id && !linkedIds.includes(b.id)).map((b) => (
                        <button key={b.id} type="button" className="notif" onClick={() => setLinks([...linkedIds, b.id])}><span className="truncate"><span className="issue__id">{b.display_id}</span> {b.title}</span></button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
          </div>

          {(isManager || bug.created_by?.id === user.id) && (
            <button className="btn btn--danger" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Delete bug</button>
          )}
        </aside>
      </div>

      {confirmDelete && <ConfirmDialog danger title="Delete this bug?" message={`${bug.display_id} and all of its comments, attachments and history will be permanently deleted.`} confirmLabel="Delete bug" onConfirm={removeBug} onCancel={() => setConfirmDelete(false)} />}
    </div>
  );
};

export default BugDetail;
