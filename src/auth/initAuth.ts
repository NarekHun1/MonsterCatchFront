// src/auth/initAuth.ts

export async function initAuth(): Promise<string | null> {
    try {
        // 0. Пробуем взять токен из localStorage
        const saved = localStorage.getItem('authToken');
        if (saved) {
            try {
                const [, payloadB64] = saved.split('.');
                const payloadJson = atob(payloadB64);
                const payload = JSON.parse(payloadJson) as { exp?: number };

                if (payload.exp && payload.exp * 1000 > Date.now()) {
                    // токен ещё живой → можно использовать
                    return saved;
                } else {
                    console.warn('⚠️ Saved token expired, clearing localStorage');
                    localStorage.removeItem('authToken');
                }
            } catch (e) {
                console.warn('⚠️ Failed to parse saved token, clearing', e);
                localStorage.removeItem('authToken');
            }
        }

        // 1. Берём initData из Telegram WebApp
        const tg = (window as any).Telegram?.WebApp;

        if (!tg) {
            console.warn('❌ Telegram.WebApp отсутствует — приложение не в Telegram');
            return null;
        }

        if (!tg.initData || tg.initData.length < 20) {
            console.warn('❌ initData пустая или слишком короткая — Telegram не передал данные');
            return null;
        }

        console.log("📨 WebApp initData:", tg.initData);

        const backendUrl =
            import.meta.env.VITE_API_BASE_URL ||
            'https://monstercatch-production.up.railway.app';

        // 2. Отправляем initData на backend
        const res = await fetch(`${backendUrl}/auth/telegram`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                initData: tg.initData,
                initDataUnsafe: tg.initDataUnsafe,
            }),
        });


        if (!res.ok) {
            const errText = await res.text();
            console.error(`❌ Backend error (webapp-auth ${res.status}):`, errText);
            return null;
        }

        // 3. Читаем ответ
        const data = await res.json();
        const token = data.token;

        if (!token) {
            console.error("❌ backend вернул ответ без token");
            return null;
        }

        // 4. Сохраняем токен
        localStorage.setItem('authToken', token);

        console.log("✅ Авторизация успешна — токен сохранён");
        return token;

    } catch (err) {
        console.error("❌ initAuth ERROR:", err);
        return null;
    }
}
