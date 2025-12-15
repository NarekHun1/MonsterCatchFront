// src/auth/initAuth.ts

/**
 * Telegram WebApp authentication
 * ✅ Always re-authenticates
 * ❌ Does NOT reuse old JWT
 * ✅ initData = source of truth
 */

export async function initAuth(): Promise<string | null> {
    try {
        const tg = (window as any).Telegram?.WebApp;

        // 1️⃣ Убеждаемся, что мы в Telegram
        if (!tg) {
            console.warn('❌ Telegram.WebApp not found');
            return null;
        }

        // 2️⃣ Проверяем initData
        if (!tg.initData || tg.initData.length < 20) {
            console.warn('❌ Telegram initData missing or too short');
            return null;
        }

        const backendUrl =
            import.meta.env.VITE_API_BASE_URL ||
            'https://monstercatch-production.up.railway.app';

        // 🔥 ВАЖНО: удаляем старый токен ПЕРЕД авторизацией
        localStorage.removeItem('authToken');

        // 3️⃣ Всегда вызываем backend
        const res = await fetch(`${backendUrl}/auth/telegram`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                initData: tg.initData,
            }),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error('❌ Telegram auth failed:', res.status, text);
            return null;
        }

        // 4️⃣ Получаем новый JWT
        const data = await res.json();
        const token: string | undefined = data?.token;

        if (!token) {
            console.error('❌ Backend returned no token');
            return null;
        }

        // 5️⃣ Сохраняем ТОЛЬКО НОВЫЙ токен
        localStorage.setItem('authToken', token);

        console.log('✅ Telegram auth success — NEW JWT issued');
        return token;

    } catch (err) {
        console.error('❌ initAuth fatal error:', err);
        localStorage.removeItem('authToken');
        return null;
    }
}
