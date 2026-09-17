import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/main.scss';
import { isTauri } from '@tauri-apps/api/core';

if (import.meta.env.PROD && !isTauri() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    }).catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
