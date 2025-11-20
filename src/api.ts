const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function apiFetch(
    path: string,
    token?: string,
    options: RequestInit = {},
) {
    const url = API_BASE_URL + path;

    const headers = new Headers(options.headers || {});

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(url, {
        ...options,
        headers,
    });

    return res;
}
