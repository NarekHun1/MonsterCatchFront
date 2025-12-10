// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import './index.css';
import App from './App';

/* ---------- ERROR LOGGER (добавить!) ---------- */
if (typeof window !== "undefined") {
    window.addEventListener("error", (event) => {
        document.body.innerHTML =
            "<pre style='color:red; font-size:22px; padding:20px; white-space:pre-wrap'>" +
            (event.error?.stack || event.message) +
            "</pre>";
    });

    window.addEventListener("unhandledrejection", (event) => {
        document.body.innerHTML =
            "<pre style='color:red; font-size:22px; padding:20px; white-space:pre-wrap'>" +
            (event.reason?.stack || event.reason) +
            "</pre>";
    });
}

/* ---------- END ERROR LOGGER ---------- */

const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;

createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
        <TonConnectUIProvider manifestUrl={manifestUrl}>
            <App />
        </TonConnectUIProvider>
    </StrictMode>,
);
