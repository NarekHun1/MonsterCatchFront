import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    base: '/',              // ← ОБЯЗАТЕЛЬНО ДЛЯ TELEGRAM WEBAPP
    build: {
        outDir: 'dist'
    },
    server: {
        host: true
    },
    preview: {
        host: true
    }
});
