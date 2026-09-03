import { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Loader from '../components/Loader';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(() => sessionStorage.getItem('auth_error') || '');
  const navigate = useNavigate();

  useEffect(() => {
    const initAuth = async () => {
      // Check if we just came back from a Microsoft redirect login
      const msToken = sessionStorage.getItem('ms_access_token');
      if (msToken) {
        sessionStorage.removeItem('ms_access_token');
        try {
          await msLogin(msToken);
          setLoading(false);
          return;
        } catch (err) {
          console.error('MS auto-login failed:', err);
          const msg = err.response?.data?.error || 'Microsoft login failed. Please try again.';
          sessionStorage.setItem('auth_error', msg);
          setAuthError(msg);
        }
      }

      // Normal check: do we have a stored JWT?
      const token = localStorage.getItem('access_token');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
          const res = await api.get('auth/me/');
          setUser(res.data);
        } catch (err) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          delete api.defaults.headers.common['Authorization'];
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (username, password) => {
    setAuthError('');
    sessionStorage.removeItem('auth_error');
    try {
      const res = await api.post('auth/login/', { username, password });
      const { access, refresh } = res.data;
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
      const userRes = await api.get('auth/me/');
      setUser(userRes.data);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Invalid credentials. Please check your username and password.';
      setAuthError(msg);
      sessionStorage.setItem('auth_error', msg);
      throw new Error(msg);
    }
  };

  const register = async (userData) => {
    setAuthError('');
    sessionStorage.removeItem('auth_error');
    try {
      const res = await api.post('auth/register/', userData);
      const { access, refresh, is_new_user } = res.data;
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
      const userRes = await api.get('auth/me/');
      setUser(userRes.data);
      navigate('/profile');
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed. Please try again.';
      setAuthError(msg);
      sessionStorage.setItem('auth_error', msg);
      throw new Error(msg);
    }
  };

  const msLogin = async (accessToken) => {
    setAuthError('');
    sessionStorage.removeItem('auth_error');
    try {
      const res = await api.post('auth/microsoft/', { access_token: accessToken });
      const { access, refresh, is_new_user } = res.data;
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
      const userRes = await api.get('auth/me/');
      setUser(userRes.data);
      
      if (is_new_user) {
        navigate('/profile');
      } else {
        navigate('/');
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Microsoft login failed. Please try again.';
      setAuthError(msg);
      sessionStorage.setItem('auth_error', msg);
      throw new Error(msg);
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    setAuthError('');
    sessionStorage.removeItem('auth_error');
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, msLogin, logout, loading, authError, setAuthError, setUser }}>
      {loading ? <Loader fullScreen text="Authenticating..." /> : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
