import Loader from '../components/Loader';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { Building, Save, ShieldAlert, Tag, Trash2, Plus } from 'lucide-react';

const OrganizationSettings = () => {
  const { user, setUser } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [tags, setTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');

  const userRole = user?.profile?.role || 'Developer';
  const isAdmin = userRole === 'Admin' || user?.is_superuser;

  useEffect(() => {
    api.get('organization/current/')
      .then(res => {
        if (res.data?.name) setOrgName(res.data.name);
      })
      .catch(err => console.error(err));

    api.get('tags/')
      .then(res => {
        setTags(Array.isArray(res.data) ? res.data : res.data.results || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await api.patch('organization/current/', { name: orgName });
      toast.success('Organization display name updated successfully!');
      
      // Update global user state for immediate topbar/sidebar update
      if (user?.profile?.organization) {
        setUser({
          ...user,
          profile: {
            ...user.profile,
            organization: {
              ...user.profile.organization,
              name: res.data.name
            }
          }
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update organization name.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = async (e) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    try {
      const res = await api.post('tags/', { name: newTagName, color: newTagColor });
      setTags([...tags, res.data]);
      setNewTagName('');
      toast.success('Tag created successfully');
    } catch (err) {
      toast.error('Failed to create tag');
    }
  };

  const handleDeleteTag = async (id) => {
    if (!window.confirm('Are you sure you want to delete this tag?')) return;
    try {
      await api.delete(`tags/${id}/`);
      setTags(tags.filter(t => t.id !== id));
      toast.success('Tag deleted successfully');
    } catch (err) {
      toast.error('Failed to delete tag');
    }
  };

  if (loading) return <Loader fullScreen />;

  if (!isAdmin) {
    return (
      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <ShieldAlert size={36} style={{ color: 'var(--status-critical)', marginBottom: '12px' }} />
        <h3>Access Restricted</h3>
        <p style={{ color: 'var(--text-muted)' }}>Only Organization Admins can manage organization settings.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Organization Settings</h1>
          <p className="page-header__subtitle">Manage your organization's display settings</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '640px' }}>
        <div className="card__header">
          <span className="card__title flex items-center gap-2">
            <Building size={18} style={{ color: 'var(--accent)' }} /> Organization Profile
          </span>
        </div>
        <div className="card__body">
          {message && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--status-resolved-bg)', color: 'var(--status-resolved)', fontSize: '0.85rem', marginBottom: '16px' }}>
              ✓ {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex-col gap-4" style={{ display: 'flex' }}>
            <div className="form-group">
              <label className="form-label">Organization Display Name *</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="e.g. AnswerGen Inc, Powerenough Corp"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                This name is displayed across your team dashboard and reports.
              </span>
            </div>

            <div className="flex justify-end" style={{ paddingTop: '12px' }}>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Organization Name'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '600px', marginTop: '24px' }}>
        <div className="card__header">
          <span className="card__title flex items-center gap-2"><Tag size={18} /> Tag Management</span>
        </div>
        <div className="card__body">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Create and manage custom tags (like 'frontend', 'regression', or 'critical') that your team can attach to bugs.
          </p>

          <form onSubmit={handleAddTag} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '24px' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Tag Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Frontend"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label">Color</label>
              <input
                type="color"
                className="form-input"
                style={{ padding: '2px', width: '60px', height: '38px', cursor: 'pointer' }}
                value={newTagColor}
                onChange={e => setNewTagColor(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn--secondary">
              <Plus size={16} /> Add Tag
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tags.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-dim)', fontSize: '0.85rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
                No tags created yet.
              </div>
            ) : (
              tags.map(tag => (
                <div key={tag.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-base)' }}>
                  <div className="flex items-center gap-2">
                    <span className="badge" style={{ backgroundColor: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}` }}>
                      {tag.name}
                    </span>
                  </div>
                  <button onClick={() => handleDeleteTag(tag.id)} className="btn btn--ghost btn--sm" style={{ color: 'var(--status-critical)' }} title="Delete Tag">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationSettings;
