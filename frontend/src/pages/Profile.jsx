import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { Save, AlertTriangle, ShieldCheck, Building } from 'lucide-react';

const Profile = () => {
  const { user, setUser } = useAuth();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    profile: {
      role: 'Developer',
      position: '',
      working_on: ''
    }
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        profile: {
          role: user.profile?.role || 'Developer',
          position: user.profile?.position || '',
          working_on: user.profile?.working_on || ''
        }
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await api.put(`users/${user.id}/`, {
        ...user,
        first_name: formData.first_name,
        last_name: formData.last_name,
        profile: formData.profile
      });
      setUser(res.data);
      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const userInitial = user?.first_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || '?';
  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`
    : user?.username;

  const isPending = user?.profile?.status === 'PendingApproval';
  const isAdmin = user?.profile?.role === 'Admin' || user?.is_superuser;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Account Setup & Profile</h1>
          <p className="page-header__subtitle">Manage your account profile, role, and organization setup</p>
        </div>
      </div>

      <div className="card profile-card">
        <div className="card__body">
          {/* Pending Approval Banner (Safety Feature) */}
          {isPending && (
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: 'var(--status-progress)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertTriangle size={24} style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.9rem' }}>Account Pending Approval</strong>
                <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                  Your organization (<strong>{user?.profile?.organization?.name}</strong>) already exists in BugTracker Pro. Your Admin has been notified to approve your role.
                </span>
              </div>
            </div>
          )}

          {/* Avatar & Org Header Section */}
          <div className="profile-card__avatar-section">
            <div className="profile-card__avatar-lg">{userInitial}</div>
            <div className="profile-card__avatar-info">
              <h3>{displayName}</h3>
              <p>{user?.email || user?.username}</p>
              {user?.profile?.organization && (
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-hover)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Building size={14} /> {user.profile.organization.name} ({user.profile.organization.domain})
                </div>
              )}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-col gap-4" style={{ display: 'flex' }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input
                  className="form-input"
                  value={formData.first_name}
                  onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="First name"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input
                  className="form-input"
                  value={formData.last_name}
                  onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Position / Title</label>
                <input
                  className="form-input"
                  value={formData.profile.position}
                  onChange={e => setFormData({
                    ...formData, profile: { ...formData.profile, position: e.target.value }
                  })}
                  placeholder="e.g. Senior QA Engineer, Lead Developer"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Role in Organization</label>
                {isAdmin ? (
                  <select
                    className="form-select"
                    value={formData.profile.role}
                    onChange={e => setFormData({
                      ...formData, profile: { ...formData.profile, role: e.target.value }
                    })}
                  >
                    <option value="Admin">Admin (Organization Owner)</option>
                    <option value="Tester">Tester / QA</option>
                    <option value="Developer">Developer</option>
                  </select>
                ) : (
                  <input
                    className="form-input"
                    value={formData.profile.role}
                    disabled
                    style={{ opacity: 0.7, cursor: 'not-allowed' }}
                  />
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Currently Working On</label>
              <textarea
                className="form-textarea"
                value={formData.profile.working_on}
                onChange={e => setFormData({
                  ...formData, profile: { ...formData.profile, working_on: e.target.value }
                })}
                placeholder="Describe what projects or features you're currently focused on..."
                style={{ minHeight: '80px' }}
              />
            </div>

            <div className="flex gap-3 items-center" style={{ paddingTop: '8px' }}>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
              {saved && (
                <span style={{ color: 'var(--status-resolved)', fontSize: '0.85rem', fontWeight: 500 }}>
                  ✓ Profile saved successfully!
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
