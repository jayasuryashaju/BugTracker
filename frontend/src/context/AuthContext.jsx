import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { tokens } from '../api';
import { errorMessage } from '../lib/utils';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const loadUser = useCallback(async () => {
    const res = await api.get('auth/me/');
    setUser(res.data);
    return res.data;
  }, []);

  const finishLogin = useCallback(async (data) => {
    tokens.set(data);
    return loadUser();
  }, [loadUser]);

  const login = async (username, password) => {
    setAuthError('');
    try {
      const res = await api.post('auth/login/', { username, password });
      await finishLogin(res.data);
      return { isNew: false };
    } catch (err) {
      throw new Error(errorMessage(err, 'Could not sign in. Please try again.'));
    }
  };

  const register = async (payload) => {
    setAuthError('');
    try {
      const res = await api.post('auth/register/', payload);
      await finishLogin(res.data);
      return { isNew: true };
    } catch (err) {
      throw new Error(errorMessage(err, 'Could not create your account. Please try again.'));
    }
  };

  const msLogin = useCallback(async (accessToken) => {
    const res = await api.post('auth/microsoft/', { access_token: accessToken });
    await finishLogin(res.data);
    return { isNew: Boolean(res.data.is_new_user) };
  }, [finishLogin]);

  const logout = useCallback(() => {
    tokens.clear();
    setUser(null);
  }, []);

  // Initial session restore (or completion of a Microsoft redirect sign-in).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const msToken = sessionStorage.getItem('ms_access_token');
      if (msToken) {
        sessionStorage.removeItem('ms_access_token');
        try {
          const { isNew } = await msLogin(msToken);
          if (!cancelled && isNew) sessionStorage.setItem('post_login_path', '/profile');
        } catch (err) {
          if (!cancelled) setAuthError(errorMessage(err, 'Microsoft sign-in failed. Please try again.'));
        }
      } else if (tokens.access || tokens.refresh) {
        try {
          await loadUser();
        } catch {
          tokens.clear();
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadUser, msLogin]);

  // The API client emits this when a session can no longer be refreshed.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, loading, authError, setAuthError, login, register, msLogin, logout, refreshUser: loadUser }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading, authError, msLogin, logout, loadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
