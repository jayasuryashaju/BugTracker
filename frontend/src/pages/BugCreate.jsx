import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';
import { errorMessage, fullName, PRIORITIES, unwrap } from '../lib/utils';
import MarkdownEditor from '../components/MarkdownEditor';
import { MediaPicker } from '../components/Media';
import { PageHead } from '../components/ui';

const BugCreate = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [people, setPeople] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tags, setTags] = useState([]);
  const [files, setFiles] = useState([]);
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
      for (let i = 0; i < files.length; i++) {
        const body = new FormData();
        body.append('bug', bug.id);
        body.append('file', files[i].file);
        try {
          await api.post('attachments/', body, { onUploadProgress: (e) => setFiles((list) => list.map((it, j) => (j === i ? { ...it, progress: Math.round((e.loaded / (e.total || e.loaded || 1)) * 100) } : it))) });
        } catch (err) {
          failed.push(files[i].file.name);
          setFiles((list) => list.map((it, j) => (j === i ? { ...it, error: errorMessage(err, 'Upload failed') } : it)));
        }
      }
      if (failed.length) toast.error(`${bug.display_id} created, but ${failed.length} file${failed.length === 1 ? '' : 's'} failed to upload: ${failed.join(', ')}. You can add them on the bug page.`, { duration: 9000 });
      else toast.success(`${bug.display_id} created`);
      navigate(`/bug/${bug.id}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not create the bug.'));
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHead title="Log a bug" subtitle="Give your team what they need to reproduce and fix it." back={{ to: '/bugs', label: 'All bugs' }} />
      <form onSubmit={submit}>
        <div className="create-grid">
          <div className="stack">
            <section className="card">
              <div className="card__body stack" style={{ gap: 20 }}>
                <div className="field">
                  <label htmlFor="title">Title</label>
                  <input id="title" className="input" required maxLength={255} autoFocus placeholder="A short summary of what's wrong" value={form.title} onChange={set('title')} />
                </div>
                <div className="field">
                  <label htmlFor="desc">Description</label>
                  <MarkdownEditor id="desc" rows={8} value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="What happened? What did you expect to happen instead?" />
                </div>
                <div className="field">
                  <label htmlFor="steps">Steps to reproduce <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
                  <MarkdownEditor id="steps" rows={5} value={form.steps_to_reproduce} onChange={(v) => setForm((f) => ({ ...f, steps_to_reproduce: v }))} placeholder={'1. Go to…\n2. Click…\n3. See the error'} />
                </div>
              </div>
            </section>
            <section className="card">
              <div className="card__head"><h2>Screenshots &amp; recordings</h2><span className="muted spacer">{files.length ? `${files.length} selected` : 'optional'}</span></div>
              <div className="card__body">
                <MediaPicker items={files} disabled={busy}
                  onAdd={(added) => setFiles((list) => [...list, ...added.map((file) => ({ file }))])}
                  onRemove={(i) => setFiles((list) => list.filter((_, j) => j !== i))} />
              </div>
            </section>
          </div>

          <aside className="stack" style={{ position: 'sticky', top: 'calc(var(--topbar-h) + 16px)' }}>
            <section className="card">
              <div className="card__head"><h2>Details</h2></div>
              <div className="card__body stack" style={{ gap: 16 }}>
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
              </div>
            </section>
            <div className="row">
              <button type="button" className="btn btn--secondary" onClick={() => navigate(-1)} disabled={busy}>Cancel</button>
              <button className="btn btn--primary grow" disabled={busy || !form.title.trim()}>{busy ? (files.length ? 'Creating & uploading…' : 'Creating…') : 'Create bug'}</button>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
};

export default BugCreate;
