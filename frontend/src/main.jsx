import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { msalInstance, msalConfigured } from './msalConfig';

async function startApp() {
  if (msalConfigured) {
    try {
      await msalInstance.initialize();
      // Back from the Microsoft redirect: hand the token to AuthContext.
      const response = await msalInstance.handleRedirectPromise();
      if (response?.accessToken) sessionStorage.setItem('ms_access_token', response.accessToken);
    } catch (err) {
      // A broken Microsoft setup must never stop password sign-in from working.
      console.error('Microsoft sign-in initialisation failed', err);
    }
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

startApp();
