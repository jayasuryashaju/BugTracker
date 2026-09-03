import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { msalInstance, loginRequest } from '../msalConfig';
import Logo from '../components/Logo';

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const { login, register, authError, setAuthError } = useAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = `${isSignUp ? 'Create Account' : 'Sign In'} | BugTracker Pro`;
  }, [isSignUp]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        await register({
          username: username || email.split('@')[0],
          email,
          password,
          first_name: firstName,
          last_name: lastName
        });
      } else {
        await login(username, password);
      }
    } catch (err) {
      // Handled in AuthContext
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = () => {
    setAuthError('');
    sessionStorage.removeItem('auth_error');
    msalInstance.loginRedirect(loginRequest);
  };

  return (
    <div className="login-page">
      <div className="login-card animate-in" style={{ width: '420px' }}>
        <div style={{ marginBottom: '28px' }}>
          <Logo size="lg" />
        </div>

        <h2 className="login-card__heading">{isSignUp ? 'Create your account' : 'Welcome back'}</h2>
        <p className="login-card__sub">
          {isSignUp ? 'Sign up to manage and track software issues' : 'Sign in to your account to continue'}
        </p>

        {authError && (
          <div className="login-card__error mb-4" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>{authError}</span>
            {authError.includes('already registered') && (
              <span style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '4px' }}>
                Tip: Contact your company administrator to invite your email address.
              </span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-card__form">
          {isSignUp && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input
                  className="form-input"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input
                  className="form-input"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>
          )}

          {isSignUp ? (
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input
                type="email"
                className="form-input"
                required
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (!username) setUsername(e.target.value.split('@')[0]);
                }}
                placeholder="you@company.com"
              />
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Username or Email</label>
              <input
                className="form-input"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username or email"
                autoComplete="username"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password *</label>
            <input
              type="password"
              className="form-input"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--lg btn--full"
            disabled={loading}
            style={{ marginTop: '4px' }}
          >
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="login-card__divider">or continue with</div>

        <button onClick={handleMicrosoftLogin} className="login-card__ms-btn" disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
            <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
          </svg>
          Continue with Microsoft
        </button>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); }}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
