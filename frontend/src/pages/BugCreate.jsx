import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { File as FileIcon, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { errorMessage, fullName, PRIORITIES, unwrap } from '../lib/utils';
import MarkdownEditor from '../components/MarkdownEditor';
import { PageHead } from '../components/ui';

const MAX_BYTES = 25 * 1024 * 1024;

const BugCreate = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fileInput = useRef(null);
  const [people, setPeople] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tags, setTags] = useState([]);
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', steps_to_reproduce: '', priority: 'Medium',
    project: params.get('project') || '', due_date: '', assigned_to_id: '', tag_ids: [],
  });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    Promise.allSettled([api.get('users/', { params: { page_size: 500 } }), api.get('projects/', { params: { page_size: 500 } }), api.get('tags/')]).then(([u, p, t]) => {
      if (u.status === 'fulfilled') setPeople(unwrap(u.value));
      if (p.status === 'fulfilled') setProjects(unwrap(p.value));
      if (t.status === 'fulfilled') setTags(unwrap(t.value));
    });
  }, []);

  const addFiles = (list) => {
    const next = [];
    Array.from(list).forEach((f) => {
      if (f.size > MAX_BYTES) toast.error(`${f.name} is larger than 25 MB`);
      else next.push(f);
    });
    setFiles((current) => [...current, ...next]);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) { toast.error('Please describe the bug.'); return; }
    setBusy(true);
    try {
      const payload = { ...form, title: form.title.trim() };
      ['project', 'due_date', 'assigned_to_id'].forEach((k) => { if (!payload[k]) delete payload[k]; });
      if (!payload.tag_ids.length) delete payload.tag_ids;
      const { data: bug } = await api.post('bugs/', payload);

      const failed = [];
      for (const file of files) {
        const body = new FormData();
        body.append('bug', bug.id);
        body.append('file', file);
        try { await api.post('attachments/', body); } catch { failed.push(file.name); }
      }
      if (failed.length) toast.error(`Bug created, but these files failed to upload: ${failed.join(', ')}`, { duration: 7000 });
      else toast.success(`${bug.display_id} created`);
      navigate(`/bug/${bug.id}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not create the bug.'));
      setBusy(false);
    }
  };

  return (
    <div className="page--narrow" style={{ margin: '0 auto' }}>
      <PageHead title="Log a bug" subtitle="Give your team what they need to reproduce and fix it." back={{ to: '/bugs', label: 'All bugs' }} />
      <form className="card" onSubmit={submit}>
        <div className="card__body stack" style={{ gap: 20 }}>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" className="input" required maxLength={255} autoFocus placeholder="A short summary of what's wrong" value={form.title} onChange={set('title')} />
          </div>

          <div className="field">
            <label htmlFor="desc">Description</label>
            <MarkdownEditor id="desc" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="What happened? What did you expect to happen instead?" />
          </div>

          <div className="field">
            <label htmlFor="steps">Steps to reproduce <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
            <MarkdownEditor id="steps" rows={4} value={form.steps_to_reproduce} onChange={(v) => setForm((f) => ({ ...f, steps_to_reproduce: v }))} placeholder={'1. Go to…\n2. Click…\n3. See the error'} />
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="prio">Priority</label>
              <select id="prio" className="select" value={form.priority} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
            </div>
            <div className="field">
              <label htmlFor="proj">Project</label>
              <select id="proj" className="select" value={form.project} onChange={set('project')}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="who">Assignee</label>
              <select id="who" className="select" value={form.assigned_to_id} onChange={set('assigned_to_id')}>
                <option value="">Unassigned</option>
                {people.map((u) => <option key={u.id} value={u.id}>{fullName(u)} · {u.profile?.role}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="due">Due date</label>
              <input id="due" type="date" className="input" value={form.due_date} onChange={set('due_date')} />
            </div>
          </div>

          {tags.length > 0 && (
            <div className="field">
              <span className="label">Tags</span>
              <div className="row row--wrap">
                {tags.map((t) => {
                  const on = form.tag_ids.includes(t.id);
                  return (
                    <button key={t.id} type="button" className="tag" aria-pressed={on} style={{ '--tag': t.color, cursor: 'pointer', outline: on ? '2px solid var(--tag)' : 'none', outlineOffset: 1 }}
                      onClick={() => setForm((f) => ({ ...f, tag_ids: on ? f.tag_ids.filter((x) => x !== t.id) : [...f.tag_ids, t.id] }))}>
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="field">
            <span className="label">Attachments</span>
            <button type="button" className="dropzone" data-over={dragging}
              onClick={() => fileInput.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}>
              <Upload size={20} style={{ marginBottom: 6 }} />
              <div>Drop screenshots or recordings here, or <b>browse</b></div>
              <div className="hint">Images, video, PDF, logs — up to 25 MB each</div>
            </button>
            <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="attachment">
                <FileIcon size={18} /><span className="truncate grow">{f.name}</span><span className="muted">{(f.size / 1024).toFixed(0)} KB</span>
                <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Remove ${f.name}`} onClick={() => setFiles((c) => c.filter((_, j) => j !== i))}><X size={15} /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="card__body form-actions" style={{ borderTop: '1px solid var(--border)' }}>
          <button type="button" className="btn btn--secondary" onClick={() => navigate(-1)}>Cancel</button>
          <button className="btn btn--primary" disabled={busy || !form.title.trim()}>{busy ? 'Creating…' : 'Create bug'}</button>
        </div>
      </form>
    </div>
  );
};

export default BugCreate;
