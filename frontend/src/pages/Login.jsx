import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Activity, KanbanSquare, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { loginRequest, msalConfigured, msalInstance } from '../msalConfig';
import Logo from '../components/Logo';

const MicrosoftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
    <rect x="1" y="1" width="9" height="9" fill="#F25022" /><rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" /><rect x="11" y="11" width="9" height="9" fill="#FFB900" />
  </svg>
);

const Login = () => {
  const { user, login, register, authError, setAuthError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ identifier: '', email: '', password: '', first_name: '', last_name: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  useEffect(() => { document.title = `${signup ? 'Create account' : 'Sign in'} · BugTracker Pro`; }, [signup]);

  if (user) return <Navigate to={location.state?.from || '/'} replace />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const switchMode = () => { setMode(signup ? 'signin' : 'signup'); setError(''); setAuthError(''); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setAuthError('');
    try {
      if (signup) {
        await register({ email: form.email, password: form.password, first_name: form.first_name, last_name: form.last_name });
        navigate('/profile', { replace: true });
      } else {
        await login(form.identifier, form.password);
        navigate(location.state?.from || '/', { replace: true });
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const microsoft = () => {
    setError('');
    setAuthError('');
    msalInstance.loginRedirect(loginRequest).catch((err) => setError(err.message || 'Microsoft sign-in failed.'));
  };

  const shownError = error || authError;

  return (
    <div className="auth">
      <section className="auth__panel">
        <div className="auth__form animate-in">
          <div style={{ marginBottom: 32 }}><Logo size="lg" /></div>
          <h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="muted" style={{ margin: '6px 0 24px' }}>
            {signup ? 'Start tracking bugs with your team in minutes.' : 'Sign in to pick up where you left off.'}
          </p>

          {shownError && <div className="alert" role="alert" style={{ marginBottom: 16 }}>{shownError}</div>}

          <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
            {signup && (
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="field"><label htmlFor="fn">First name</label><input id="fn" className="input" value={form.first_name} onChange={set('first_name')} autoComplete="given-name" /></div>
                <div className="field"><label htmlFor="ln">Last name</label><input id="ln" className="input" value={form.last_name} onChange={set('last_name')} autoComplete="family-name" /></div>
              </div>
            )}
            {signup ? (
              <div className="field"><label htmlFor="em">Work email</label><input id="em" type="email" required className="input" value={form.email} onChange={set('email')} placeholder="you@company.com" autoComplete="email" /></div>
            ) : (
              <div className="field"><label htmlFor="id">Email or username</label><input id="id" required className="input" value={form.identifier} onChange={set('identifier')} autoComplete="username" autoFocus /></div>
            )}
            <div className="field">
              <label htmlFor="pw">Password</label>
              <input id="pw" type="password" required className="input" value={form.password} onChange={set('password')} autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 8 : undefined} />
              {signup && <span className="hint">At least 8 characters, not too common.</span>}
            </div>
            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
              {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          {msalConfigured && (
            <>
              <div className="divider-text">or</div>
              <button className="btn btn--secondary btn--lg btn--block" onClick={microsoft} disabled={busy}><MicrosoftIcon /> Continue with Microsoft</button>
            </>
          )}

          <p className="muted" style={{ textAlign: 'center', marginTop: 24 }}>
            {signup ? 'Already have an account?' : 'New to BugTracker Pro?'}{' '}
            <button type="button" className="link" onClick={switchMode}>{signup ? 'Sign in' : 'Create an account'}</button>
          </p>
          {signup && <p className="hint" style={{ textAlign: 'center', marginTop: 8 }}>Invited by a teammate? Sign up with the email they invited.</p>}
        </div>
      </section>
      <aside className="auth__aside" aria-hidden="true">
        <h2>Find it. Fix it. Ship it.</h2>
        <ul>
          <li><Zap size={20} /><span><b>Live by default.</b> Assignments, comments and status changes appear for everyone instantly.</span></li>
          <li><KanbanSquare size={20} /><span><b>Board and list views.</b> Drag bugs across Open, In Progress, Resolved and Closed.</span></li>
          <li><Activity size={20} /><span><b>See the trend.</b> Created versus resolved, priority mix and overdue work at a glance.</span></li>
          <li><ShieldCheck size={20} /><span><b>Roles that make sense.</b> Admins, managers, testers and developers each see what they need.</span></li>
        </ul>
      </aside>
    </div>
  );
};

export default Login;
