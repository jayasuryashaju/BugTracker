import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api';
import { errorMessage, fullName, unwrap } from '../lib/utils';
import { Avatar, Modal, RoleBadge } from './ui';

/** Create (project === null) or edit a project and its members. */
const ProjectModal = ({ project, onClose, onSaved }) => {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [memberIds, setMemberIds] = useState(project?.members?.map((m) => m.id) || []);
  const [people, setPeople] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('users/', { params: { page_size: 500 } }).then((r) => setPeople(unwrap(r))).catch(() => {}); }, []);

  const toggle = (id) => setMemberIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { name: name.trim(), description, member_ids: memberIds };
      const res = project ? await api.patch(`projects/${project.id}/`, body) : await api.post('projects/', body);
      toast.success(project ? 'Project updated' : 'Project created');
      onSaved(res.data);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the project.'));
      setBusy(false);
    }
  };

  return (
    <Modal title={project ? 'Edit project' : 'New project'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal__body stack" style={{ gap: 16 }}>
          <div className="field"><label htmlFor="pn">Name</label><input id="pn" className="input" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mobile app" /></div>
          <div className="field"><label htmlFor="pd">Description</label><textarea id="pd" className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this project cover?" /></div>
          <div className="field">
            <span className="label">Members <span className="muted" style={{ fontWeight: 400 }}>({memberIds.length} selected)</span></span>
            <span className="hint">Developers only see projects they are a member of. Admins and managers see everything.</span>
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
              {people.map((p) => (
                <label key={p.id} className="list-row" style={{ cursor: 'pointer', padding: '8px 12px' }}>
                  <input type="checkbox" style={{ accentColor: 'var(--accent)' }} checked={memberIds.includes(p.id)} onChange={() => toggle(p.id)} />
                  <Avatar user={p} size="sm" /><span className="grow truncate">{fullName(p)}</span><RoleBadge role={p.profile?.role} />
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={busy || !name.trim()}>{busy ? 'Saving…' : project ? 'Save changes' : 'Create project'}</button>
        </div>
      </form>
    </Modal>
  );
};

export default ProjectModal;
