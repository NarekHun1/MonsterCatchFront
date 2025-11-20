import React, { useEffect, useState } from 'react';
import { apiFetch } from './api';

interface InviteFriendsProps {
    token: string;
    onBack: () => void;
}

// базовый URL твоего API — можешь вынести в env
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

if (!API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not set');
}

export const InviteFriends: React.FC<InviteFriendsProps> = ({ token, onBack }) => {
    const [link, setLink] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadReferralLink() {
            try {
                setLoading(true);
                setError(null);

                const res = await apiFetch(`${API_BASE_URL}/referral/link`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (!res.ok) {
                    const text = await res.text();
                    console.error('Referral link error:', res.status, text);
                    setError('Не удалось получить реферальную ссылку. Попробуй позже.');
                    return;
                }

                const data = await res.json();
                console.log('Referral link data:', data);

                if (!data.link) {
                    setError('Сервер не вернул ссылку. Попробуй позже.');
                    return;
                }

                setLink(data.link);
            } catch (e) {
                console.error('Referral link fetch failed', e);
                setError('Ошибка соединения с сервером.');
            } finally {
                setLoading(false);
            }
        }

        loadReferralLink();
    }, [token]);

    const handleShare = () => {
        if (!link) return;

        const tg = (window as any).Telegram?.WebApp;
        const text = 'Залетай в охоту на монстров! Вот моя ссылка:';

        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
            link,
        )}&text=${encodeURIComponent(text)}`;

        if (tg?.openTelegramLink) {
            tg.openTelegramLink(shareUrl);
        } else {
            // запасной вариант — открыть в браузере
            window.open(shareUrl, '_blank');
        }
    };

    return (
        <div className="panel panel-menu">
            <h2 className="panel-title">Пригласить друга</h2>

            {loading && <p className="panel-muted">Загружаем твою ссылку…</p>}

            {!loading && error && <p className="panel-muted">{error}</p>}

            {!loading && !error && (
                <>
                    <p className="panel-muted">
                        Отправь эту ссылку друзьям, чтобы они зашли в игру через тебя и ты
                        получил бонусы ⭐
                    </p>

                    <div className="referral-box">
                        <span className="referral-link">{link}</span>
                    </div>

                    <button className="menu-btn" onClick={handleShare}>
                        📤 Отправить другу в Telegram
                    </button>
                </>
            )}

            <button className="menu-card" onClick={onBack}>
                ⬅️ Назад в меню
            </button>
        </div>
    );
};
