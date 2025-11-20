// src/api.ts
const rawBase = import.meta.env.VITE_API_BASE_URL;

// на всякий случай убираем хвостовой /
const API_BASE_URL = rawBase ? rawBase.replace(/\/+$/, '') : '';

if (!API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not set');
}

/**
 * Единая функция для запросов:
 * apiFetch('/game/start', token, { method: 'POST', body: ... })
 */
export async function apiFetch(
    path: string,
    token?: string,
    options: RequestInit = {},
) {
    const url = `${API_BASE_URL}${path}`;

    const headers = new Headers(options.headers || {});

    // Авторизация
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    // Контент-тайп по умолчанию, если есть body
    if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(url, {
        ...options,
        headers,
    });

    return res;
}
