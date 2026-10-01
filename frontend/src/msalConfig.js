import { PublicClientApplication } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_MSAL_CLIENT_ID;

/** Microsoft sign-in is only offered when an Azure app registration is configured. */
export const msalConfigured = Boolean(clientId);

const msalConfig = {
  auth: {
    clientId: clientId || '00000000-0000-0000-0000-000000000000',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MSAL_TENANT_ID || 'common'}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: false,
  },
  cache: { cacheLocation: 'localStorage' },
};

const loginRequest = { scopes: ['User.Read'] };
const msalInstance = new PublicClientApplication(msalConfig);

export { msalInstance, msalConfig, loginRequest };
