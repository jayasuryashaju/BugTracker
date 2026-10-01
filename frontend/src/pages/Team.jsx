import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, Search, Trash2, UserPlus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { errorMessage, formatDate, fullName, ROLES, unwrap } from '../lib/utils';
import { Avatar, ConfirmDialog, EmptyState, PageHead, RoleBadge, RowsSkeleton } from '../components/ui';

const Team = () => {
  const { user, refreshUser } = useAuth();
  const [members, setMembers] = useState(null);
  const [invites, setInvites] = useState([]);
  const [search, setSearch] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Developer');
  const [inviting, setInviting] = useState(false);
  const [revoke, setRevoke] = useState(null);

  const myRole = user?.profile?.role;
  const isAdmin = myRole === 'Admin' || user?.is_superuser;
  const canInvite = isAdmin || myRole === 'Manager';

  const load = useCallback(async () => {
    const [m, i] = await Promise.allSettled([api.get('users/', { params: { page_size: 500 } }), canInvite ? api.get('invites/', { params: { page_size: 200 } }) : Promise.resolve({ data: [] })]);
    setMembers(m.status === 'fulfilled' ? unwrap(m.value) : []);
    if (i.status === 'fulfilled') setInvites(unwrap(i.value));
  }, [canInvite]);

  useEffect(() => { load(); }, [load]);

  const invite = async (e) => {
    e.preventDefault();
    setInviting(true);
    try {
      await api.post('invites/', { email: email.trim(), role });
      toast.success(`Invite created for ${email.trim()}. They join ${user.profile.organization?.name || 'your organization'} when they sign up with that address.`, { duration: 6000 });
      setEmail('');
      load();
    } catch (err) { toast.error(errorMessage(err, 'Could not create the invite.')); }
    setInviting(false);
  };

  const changeRole = async (member, newRole) => {
    try {
      await api.patch(`users/${member.id}/`, { profile: { role: newRole } });
      toast.success(`${fullName(member)} is now ${newRole === 'Admin' ? 'an' : 'a'} ${newRole}`);
      if (member.id === user.id) refreshUser();
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not change that role.'));
      load();
    }
  };

  const revokeInvite = async () => {
    try { await api.delete(`invites/${revoke.id}/`); setInvites((l) => l.filter((x) => x.id !== revoke.id)); toast.success('Invite revoked'); }
    catch (err) { toast.error(errorMessage(err)); }
    setRevoke(null);
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (members || []).filter((m) => !q || `${fullName(m)} ${m.email} ${m.profile?.position || ''}`.toLowerCase().includes(q));
  }, [members, search]);
  const pending = invites.filter((i) => !i.accepted);

  return (
    <div>
      <PageHead title="Team" subtitle={`People in ${user?.profile?.organization?.name || 'your organization'}.`} />

      <div className="stack">
        {canInvite && (
          <section className="card">
            <div className="card__head"><UserPlus size={16} style={{ color: 'var(--text-3)' }} /><h2>Invite someone</h2></div>
            <form className="card__body row row--wrap" style={{ alignItems: 'flex-end' }} onSubmit={invite}>
              <div className="field grow" style={{ minWidth: 220 }}><label htmlFor="ie">Email</label><input id="ie" type="email" required className="input" placeholder="colleague@company.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="field" style={{ width: 160 }}>
                <label htmlFor="ir">Role</label>
                <select id="ir" className="select" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.filter((r) => isAdmin || r !== 'Admin').map((r) => <option key={r}>{r}</option>)}</select>
              </div>
              <button className="btn btn--primary" disabled={inviting || !email.trim()}>{inviting ? 'Inviting…' : 'Send invite'}</button>
            </form>
            <p className="hint" style={{ padding: '0 18px 16px' }}>No email is sent. Tell them to sign up (or sign in with Microsoft) using this address and they will join automatically.</p>
          </section>
        )}

        <section className="card card--flush">
          <div className="card__head">
            <Users size={16} style={{ color: 'var(--text-3)' }} /><h2>Members</h2><span className="muted">{members?.length ?? ''}</span>
            <div className="input-icon spacer" style={{ width: 240 }}><Search size={15} /><input className="input input--sm" type="search" placeholder="Filter…" aria-label="Filter members" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>
          {members === null ? <RowsSkeleton rows={4} /> : shown.length === 0 ? <EmptyState icon={Users} title="No one matches that search" /> : shown.map((m) => (
            <div key={m.id} className="list-row" style={{ flexWrap: 'wrap' }}>
              <Avatar user={m} size="md" />
              <div className="grow" style={{ minWidth: 160 }}>
                <div style={{ fontWeight: 600 }}>{fullName(m)} {m.id === user.id && <span className="badge badge--accent badge--plain" style={{ marginLeft: 4 }}>You</span>}</div>
                <div className="muted truncate">{m.email}{m.profile?.position ? ` · ${m.profile.position}` : ''}</div>
              </div>
              {isAdmin ? (
                <select className="select select--sm" style={{ width: 130 }} aria-label={`Role for ${fullName(m)}`} value={m.profile?.role || 'Developer'} onChange={(e) => changeRole(m, e.target.value)}>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              ) : <RoleBadge role={m.profile?.role} />}
            </div>
          ))}
        </section>

        {canInvite && pending.length > 0 && (
          <section className="card card--flush">
            <div className="card__head"><Mail size={16} style={{ color: 'var(--text-3)' }} /><h2>Pending invites</h2><span className="muted">{pending.length}</span></div>
            {pending.map((i) => (
              <div key={i.id} className="list-row">
                <div className="grow"><div style={{ fontWeight: 550 }}>{i.email}</div><div className="muted">Invited {formatDate(i.created_at)} by {i.invited_by}</div></div>
                <RoleBadge role={i.role} />
                <button className="btn btn--ghost btn--icon btn--sm" aria-label={`Revoke invite for ${i.email}`} onClick={() => setRevoke(i)}><Trash2 size={15} /></button>
              </div>
            ))}
          </section>
        )}
      </div>
      {revoke && <ConfirmDialog danger title="Revoke invite" message={`${revoke.email} will no longer be able to join with this invite.`} confirmLabel="Revoke" onConfirm={revokeInvite} onCancel={() => setRevoke(null)} />}
    </div>
  );
};

export default Team;
