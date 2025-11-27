// src/auth/initAuth.ts

export async function initAuth(): Promise<string | null> {
    try {
        // 0. Пробуем взять токен из localStorage (если уже логинились раньше)
        const saved = localStorage.getItem('authToken');
        if (saved) {
            return saved;
        }

        // 1. Берём initData из Telegram WebApp
        const tg = (window as any).Telegram?.WebApp;
        if (!tg || !tg.initData) {
            console.warn('Нет Telegram.WebApp.initData — это, скорее всего, не Telegram');
            return null;
        }

        const backendUrl =
            import.meta.env.VITE_API_BASE_URL ||
            'https://monstercatch-production.up.railway.app';

        const res = await fetch(`${backendUrl}/telegram/webapp-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData }),
        });

        if (!res.ok) {
            console.error(
                'Backend error (webapp-auth):',
                res.status,
                await res.text(),
            );
            return null;
        }

        const data = await res.json();
        const token = data.token as string | undefined;

        if (!token) {
            console.error('webapp-auth ответил без token');
            return null;
        }

        localStorage.setItem('authToken', token);
        return token;
    } catch (err) {
        console.error('initAuth ERROR:', err);
        return null;
    }
}
