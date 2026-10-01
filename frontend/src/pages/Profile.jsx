import { useEffect, useState } from 'react';
import { Building, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { errorMessage, fullName } from '../lib/utils';
import { Avatar, PageHead, RoleBadge } from '../components/ui';

const Profile = () => {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ first_name: '', last_name: '', position: '', working_on: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setForm({ first_name: user.first_name || '', last_name: user.last_name || '', position: user.profile?.position || '', working_on: user.profile?.working_on || '' });
  }, [user]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const dirty = user && (form.first_name !== (user.first_name || '') || form.last_name !== (user.last_name || '') || form.position !== (user.profile?.position || '') || form.working_on !== (user.profile?.working_on || ''));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch(`users/${user.id}/`, {
        first_name: form.first_name.trim(), last_name: form.last_name.trim(),
        profile: { position: form.position, working_on: form.working_on },
      });
      setUser(res.data);
      toast.success('Profile saved');
    } catch (err) { toast.error(errorMessage(err, 'Could not save your profile.')); }
    setSaving(false);
  };

  const org = user?.profile?.organization;
  return (
    <div>
      <PageHead title="My profile" subtitle="How you appear to your teammates." />
      <form className="card" onSubmit={submit}>
        <div className="card__body stack" style={{ gap: 20 }}>
          <div className="profile-hero">
            <Avatar user={user} size="lg" />
            <div style={{ minWidth: 0 }}>
              <h2>{fullName(user)}</h2>
              <div className="muted truncate">{user.email}</div>
              <div className="row" style={{ marginTop: 6 }}>
                <RoleBadge role={user.profile?.role} />
                {org && <span className="muted row" style={{ gap: 4 }}><Building size={13} />{org.name}</span>}
              </div>
            </div>
          </div>
          <div className="form-grid">
            <div className="field"><label htmlFor="fn">First name</label><input id="fn" className="input" autoComplete="given-name" value={form.first_name} onChange={set('first_name')} /></div>
            <div className="field"><label htmlFor="ln">Last name</label><input id="ln" className="input" autoComplete="family-name" value={form.last_name} onChange={set('last_name')} /></div>
          </div>
          <div className="field"><label htmlFor="pos">Job title</label><input id="pos" className="input" maxLength={100} placeholder="e.g. Senior QA engineer" value={form.position} onChange={set('position')} /></div>
          <div className="field"><label htmlFor="wo">Currently working on</label><textarea id="wo" className="textarea" rows={3} placeholder="What are you focused on right now?" value={form.working_on} onChange={set('working_on')} /></div>
          <p className="hint">Your role ({user.profile?.role}) is managed by your organization&apos;s admins on the Team page.</p>
        </div>
        <div className="card__body form-actions" style={{ borderTop: '1px solid var(--border)' }}>
          <button className="btn btn--primary" disabled={saving || !dirty}><Save size={15} /> {saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
};

export default Profile;
