
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Pendaftaran Service Worker yang lebih selamat
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Hanya daftar jika bukan di persekitaran preview yang bermasalah origin
    const isPreview = window.location.hostname.includes('usercontent.goog');
    
    if (!isPreview) {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('SERQI: Engine Active', reg.scope))
        .catch(err => console.debug('SERQI: ServiceWorker registration deferred', err.message));
    } else {
      console.log('SERQI: Running in Preview Mode - Offline engine disabled for stability');
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root not found");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
