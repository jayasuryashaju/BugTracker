import Loader from '../components/Loader';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { Users, UserPlus, Mail } from 'lucide-react';

const Team = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);

  // Invite state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Developer');
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState('');

  const userRole = user?.profile?.role || 'Developer';
  const isAdmin = userRole === 'Admin' || user?.is_superuser;
  const isManagerOrAdmin = userRole === 'Admin' || userRole === 'Manager' || userRole === 'Tester' || user?.is_superuser;

  const fetchData = async () => {
    try {
      const [membersRes, invitesRes] = await Promise.all([
        api.get('users/'),
        api.get('invites/')
      ]);
      setMembers(Array.isArray(membersRes.data) ? membersRes.data : membersRes.data.results || []);
      setInvites(Array.isArray(invitesRes.data) ? invitesRes.data : invitesRes.data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email) return;
    setInviting(true);
    setMessage('');
    try {
      await api.post('invites/', { email, role });
      setEmail('');
      toast.success(`Invite sent to ${email} as ${role}!`);
      fetchData();
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.email?.[0] || err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'Failed to send invite.';
      toast.error(errorMsg);
    } finally {
      setInviting(false);
    }
  };

  const handleMemberRoleChange = async (memberId, newRole) => {
    try {
      const member = members.find(m => m.id === memberId);
      if (!member) return;

      await api.put(`users/${memberId}/`, {
        ...member,
        profile: {
          ...member.profile,
          role: newRole
        }
      });
      toast.success('Role updated successfully!');
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.profile?.role || 'Failed to update member role.';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    }
  };

  if (loading) return <Loader fullScreen />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Team & User Management</h1>
          <p className="page-header__subtitle">
            Manage organization members, assign roles, and send email invites
          </p>
        </div>
      </div>

      <div className="flex-col gap-6" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Invite Form for Admins & Managers */}
        {isManagerOrAdmin && (
          <div className="card">
            <div className="card__header">
              <span className="card__title flex items-center gap-2">
                <UserPlus size={18} style={{ color: 'var(--accent)' }} /> Invite New Team Member
              </span>
            </div>
            <div className="card__body">
              {message && (
                <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--status-resolved-bg)', color: 'var(--status-resolved)', fontSize: '0.85rem', marginBottom: '16px' }}>
                  ✓ {message}
                </div>
              )}
              <form onSubmit={handleInvite} className="flex gap-4 items-center">
                <div className="form-group" style={{ flex: 2 }}>
                  <input
                    type="email"
                    className="form-input"
                    required
                    placeholder="Enter team member's email (e.g. colleague@company.com)"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
                    <option value="Developer">Developer</option>
                    <option value="Tester">Tester / QA</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <button type="submit" className="btn btn--primary" disabled={inviting}>
                  {inviting ? 'Inviting...' : 'Send Invite'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Team Members List */}
        <div className="card">
          <div className="card__header">
            <span className="card__title flex items-center gap-2">
              <Users size={18} /> Active Members ({members.length})
            </span>
          </div>
          <div className="card__body" style={{ padding: 0 }}>
            <div className="bug-table">
              <div className="bug-table__header" style={{ gridTemplateColumns: 'minmax(200px, 2fr) minmax(200px, 2fr) minmax(150px, 1fr) minmax(150px, 1fr)' }}>
                <span>Member</span>
                <span>Email</span>
                <span>Role</span>
                <span>Position</span>
              </div>
              {members.map(m => (
                <div key={m.id} className="bug-table__row" style={{ gridTemplateColumns: 'minmax(200px, 2fr) minmax(200px, 2fr) minmax(150px, 1fr) minmax(150px, 1fr)', cursor: 'default' }}>
                  <div className="flex items-center gap-3">
                    <div className="topbar__avatar" style={{ width: 32, height: 32, fontSize: '0.8rem' }}>
                      {m.first_name?.[0]?.toUpperCase() || m.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="bug-table__title">
                        {m.first_name ? `${m.first_name} ${m.last_name || ''}` : m.username}
                      </div>
                    </div>
                  </div>
                  <div className="bug-table__cell">{m.email || m.username}</div>
                  <div className="bug-table__cell">
                    {isAdmin ? (
                      <select
                        className="form-select"
                        style={{ padding: '2px 6px', fontSize: '0.78rem', height: '28px' }}
                        value={m.profile?.role || 'Developer'}
                        onChange={e => handleMemberRoleChange(m.id, e.target.value)}
                      >
                        <option value="Admin">Admin</option>
                        <option value="Manager">Manager</option>
                        <option value="Tester">Tester</option>
                        <option value="Developer">Developer</option>
                      </select>
                    ) : (
                      <span className={`badge ${m.profile?.role === 'Admin' ? 'badge--critical' : m.profile?.role === 'Manager' ? 'badge--inprogress' : 'badge--open'}`}>
                        {m.profile?.role || 'Developer'}
                      </span>
                    )}
                  </div>
                  <div className="bug-table__cell text-muted" style={{ fontSize: '0.8rem' }}>
                    {m.profile?.position || 'Team Member'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pending Invites */}
        {invites.length > 0 && (
          <div className="card">
            <div className="card__header">
              <span className="card__title flex items-center gap-2">
                <Mail size={18} /> Pending Invites ({invites.filter(i => !i.accepted).length})
              </span>
            </div>
            <div className="card__body" style={{ padding: 0 }}>
              <div className="bug-table">
                <div className="bug-table__header" style={{ gridTemplateColumns: 'minmax(250px, 2fr) minmax(150px, 1fr) minmax(150px, 1fr)' }}>
                  <span>Email</span>
                  <span>Role</span>
                  <span>Status</span>
                </div>
                {invites.map(inv => (
                  <div key={inv.id} className="bug-table__row" style={{ gridTemplateColumns: 'minmax(250px, 2fr) minmax(150px, 1fr) minmax(150px, 1fr)', cursor: 'default' }}>
                    <div className="bug-table__cell" style={{ fontWeight: 500 }}>{inv.email}</div>
                    <div className="bug-table__cell">
                      <span className="badge badge--open">{inv.role}</span>
                    </div>
                    <div className="bug-table__cell">
                      {inv.accepted ? (
                        <span className="badge badge--resolved">Accepted</span>
                      ) : (
                        <span className="badge badge--inprogress">Pending</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Team;
