import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { registerServiceWorker } from './pwa.js';

registerServiceWorker();

// HashRouter: the app is a static bundle that may be served from any path
// (e.g. GitHub Pages' /<repo>/) with no server-side SPA fallback.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
);
