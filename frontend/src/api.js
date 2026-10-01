import axios from 'axios';
import { API_BASE } from './lib/utils';

export const BASE_URL = API_BASE;

const api = axios.create({ baseURL: `${BASE_URL}/api/` });

export const tokens = {
  get access() { return localStorage.getItem('access_token'); },
  get refresh() { return localStorage.getItem('refresh_token'); },
  set({ access, refresh }) {
    if (access) localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);
  },
  clear() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
};

api.interceptors.request.use((config) => {
  const token = tokens.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Concurrent 401s share one refresh request instead of racing (refresh tokens rotate).
let refreshing = null;
const refreshAccessToken = () => {
  if (!refreshing) {
    refreshing = axios
      .post(`${BASE_URL}/api/auth/refresh/`, { refresh: tokens.refresh })
      .then((res) => {
        tokens.set(res.data);
        return res.data.access;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
};

const isAuthEndpoint = (url = '') => /^\/?auth\/(login|register|microsoft|refresh)\//.test(url);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint(original.url)) {
      original._retry = true;
      if (tokens.refresh) {
        try {
          const access = await refreshAccessToken();
          original.headers.Authorization = `Bearer ${access}`;
          return api(original);
        } catch {
          // fall through to logout
        }
      }
      tokens.clear();
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(error);
  },
);

export default api;
