import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { msalInstance } from './msalConfig'

async function startApp() {
  await msalInstance.initialize();

  // Handle the redirect response when Microsoft sends the user back
  const response = await msalInstance.handleRedirectPromise();
  
  if (response && response.accessToken) {
    // Store the MS access token temporarily so AuthContext can pick it up
    sessionStorage.setItem('ms_access_token', response.accessToken);
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

startApp();
