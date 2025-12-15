// src/auth/initAuth.ts

/**
 * Telegram WebApp auth
 * - ВСЕГДА перевыпускает JWT
 * - НЕ доверяет localStorage
 * - Telegram initData = source of truth
 */

export async function initAuth(): Promise<string | null> {
    try {
        const tg = (window as any).Telegram?.WebApp;

        // 1️⃣ Проверка, что мы реально в Telegram
        if (!tg) {
            console.warn('❌ Telegram.WebApp not found');
            return null;
        }

        // 2️⃣ Проверка initData
        if (!tg.initData || tg.initData.length < 20) {
            console.warn('❌ Telegram initData missing or too short');
            return null;
        }

        const backendUrl =
            import.meta.env.VITE_API_BASE_URL ||
            'https://monstercatch-production.up.railway.app';

        // 3️⃣ Запрос на backend (ВСЕГДА)
        const res = await fetch(`${backendUrl}/auth/telegram`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                initData: tg.initData,
            }),
        });

        // 4️⃣ Ошибка авторизации
        if (!res.ok) {
            const text = await res.text();
            console.error('❌ Telegram auth failed:', res.status, text);
            localStorage.removeItem('authToken');
            return null;
        }

        // 5️⃣ Читаем ответ
        const data = await res.json();
        const token: string | undefined = data?.token;

        if (!token) {
            console.error('❌ Backend returned no token');
            localStorage.removeItem('authToken');
            return null;
        }

        // 6️⃣ Сохраняем НОВЫЙ токен
        localStorage.setItem('authToken', token);

        console.log('✅ Telegram auth success — new JWT stored');
        return token;

    } catch (err) {
        console.error('❌ initAuth fatal error:', err);
        localStorage.removeItem('authToken');
        return null;
    }
}
