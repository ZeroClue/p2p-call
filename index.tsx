
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { enforceHTTPS, checkWebRTCSupport } from './utils/security';

// Enforce HTTPS in production
enforceHTTPS();

// Check WebRTC support
const { supported, missingFeatures } = checkWebRTCSupport();
if (!supported) {
  console.error('WebRTC is not fully supported in this browser. Missing features:', missingFeatures);
  alert('Your browser does not support all required features for video calling. Please use a modern browser like Chrome, Firefox, or Edge.');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Register service worker for PWA capabilities
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}
