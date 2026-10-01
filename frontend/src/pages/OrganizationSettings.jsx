import { useEffect, useState } from 'react';
import { Building, Plus, Save, ShieldAlert, Tag as TagIcon, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { errorMessage, unwrap } from '../lib/utils';
import { ConfirmDialog, EmptyState, PageHead, PageLoader, TagChip } from '../components/ui';

const OrganizationSettings = () => {
  const { user, refreshUser } = useAuth();
  const isAdmin = user?.profile?.role === 'Admin' || user?.is_superuser;
  const canManageTags = isAdmin || user?.profile?.role === 'Manager';
  const [org, setOrg] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#4f46e5');
  const [removeTag, setRemoveTag] = useState(null);

  useEffect(() => {
    api.get('organization/current/').then((r) => { setOrg(r.data); setName(r.data.name); }).catch((e) => toast.error(errorMessage(e)));
    api.get('tags/').then((r) => setTags(unwrap(r))).catch(() => setTags([]));
  }, []);

  if (!isAdmin && !canManageTags) {
    return <EmptyState icon={ShieldAlert} title="Admins only">Only organization admins can manage these settings.</EmptyState>;
  }
  if (!org || tags === null) return <PageLoader />;

  const saveName = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch('organization/current/', { name });
      setOrg(res.data);
      await refreshUser();
      toast.success('Organization name updated');
    } catch (err) { toast.error(errorMessage(err)); }
    setSaving(false);
  };

  const addTag = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('tags/', { name: tagName.trim(), color: tagColor });
      setTags((t) => [...t, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setTagName('');
      toast.success('Tag created');
    } catch (err) { toast.error(errorMessage(err, 'Could not create the tag.')); }
  };

  const deleteTag = async () => {
    try { await api.delete(`tags/${removeTag.id}/`); setTags((t) => t.filter((x) => x.id !== removeTag.id)); toast.success('Tag deleted'); }
    catch (err) { toast.error(errorMessage(err)); }
    setRemoveTag(null);
  };

  return (
    <div className="page--narrow" style={{ margin: '0 auto' }}>
      <PageHead title="Organization" subtitle="Settings that apply to everyone in your workspace." />
      <div className="stack">
        <section className="card">
          <div className="card__head"><Building size={16} style={{ color: 'var(--text-3)' }} /><h2>Profile</h2></div>
          <form className="card__body stack" onSubmit={saveName}>
            <div className="field">
              <label htmlFor="on">Display name</label>
              <input id="on" className="input" required maxLength={255} disabled={!isAdmin} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field"><label htmlFor="od">Domain</label><input id="od" className="input" disabled value={org.domain} /><span className="hint">The domain identifies your organization and can&apos;t be changed.</span></div>
            {isAdmin && <div className="form-actions" style={{ padding: 0 }}><button className="btn btn--primary" disabled={saving || !name.trim() || name.trim() === org.name}><Save size={15} /> {saving ? 'Saving…' : 'Save'}</button></div>}
          </form>
        </section>

        <section className="card">
          <div className="card__head"><TagIcon size={16} style={{ color: 'var(--text-3)' }} /><h2>Tags</h2></div>
          <div className="card__body stack">
            <p className="muted">Tags label bugs across projects, like <i>regression</i> or <i>frontend</i>.</p>
            {canManageTags && (
              <form className="row" style={{ alignItems: 'flex-end' }} onSubmit={addTag}>
                <div className="field grow"><label htmlFor="tn">New tag</label><input id="tn" className="input" required maxLength={50} placeholder="e.g. regression" value={tagName} onChange={(e) => setTagName(e.target.value)} /></div>
                <div className="field"><label htmlFor="tc">Color</label><input id="tc" type="color" className="input" value={tagColor} onChange={(e) => setTagColor(e.target.value)} /></div>
                <button className="btn btn--secondary" disabled={!tagName.trim()}><Plus size={15} /> Add</button>
              </form>
            )}
            {tags.length === 0 ? <p className="muted">No tags yet.</p> : (
              <div className="stack" style={{ gap: 0 }}>
                {tags.map((t) => (
                  <div key={t.id} className="list-row" style={{ padding: '8px 0' }}>
                    <TagChip tag={t} /><span className="spacer" />
                    {canManageTags && <button className="btn btn--ghost btn--icon btn--sm" aria-label={`Delete tag ${t.name}`} onClick={() => setRemoveTag(t)}><Trash2 size={15} /></button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
      {removeTag && <ConfirmDialog danger title="Delete tag" message={`Remove “${removeTag.name}” from all bugs and delete it?`} confirmLabel="Delete" onConfirm={deleteTag} onCancel={() => setRemoveTag(null)} />}
    </div>
  );
};

export default OrganizationSettings;
