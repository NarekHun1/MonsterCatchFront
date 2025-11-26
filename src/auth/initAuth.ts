// src/auth/initAuth.ts

/**
 * Выполняет авторизацию WebApp:
 * 1) Если в URL есть ?token=..., используем его.
 * 2) Если нет — отправляем Telegram.WebApp.initData на backend.
 * 3) Если ничего нет — возвращаем null.
 */

export async function initAuth(): Promise<string | null> {
    try {
        // 1. Проверяем токен в URL
        const params = new URLSearchParams(window.location.search);
        let token = params.get('token');

        if (token) {
            localStorage.setItem('authToken', token);
            return token;
        }

        // 2. Пробуем получить initData из Telegram Mini App
        const tg = (window as any).Telegram?.WebApp;
        if (tg && tg.initData) {
            const backendUrl =
                import.meta.env.VITE_API_BASE_URL ||
                'https://monstercatch-production.up.railway.app';

            const res = await fetch(`${backendUrl}/telegram/webapp-auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: tg.initData }),
            });

            if (res.ok) {
                const data = await res.json();
                token = data.token;

                if (token) {
                    localStorage.setItem('authToken', token);
                    return token;
                }
            } else {
                console.error(
                    'Backend error (webapp-auth):',
                    res.status,
                    await res.text(),
                );
            }
        }

        // 3. Если нет токена ни в URL, ни initData — это НЕ Telegram
        return null;
    } catch (err) {
        console.error('initAuth ERROR:', err);
        return null;
    }
}
