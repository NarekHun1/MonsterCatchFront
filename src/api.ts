// src/api.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
    console.warn('VITE_API_BASE_URL is not set!');
}

export async function apiFetch(
    path: string,
    options: RequestInit = {},
    token?: string,
) {
    const url = API_BASE_URL + path;

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    if (token) {
        (headers as any).Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, {
        ...options,
        headers,
    });

    return res;
}
