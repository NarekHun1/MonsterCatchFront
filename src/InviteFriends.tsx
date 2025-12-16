// src/InviteFriends.tsx
import React, { useEffect, useState } from 'react';
import { apiFetch } from './api';
import {BlueStarIcon} from "./styles/BlueStarIcon.tsx";

interface InviteFriendsProps {
    token: string;
    onBack: () => void;
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

                // 👉 новый вызов: путь + token
                const res = await apiFetch('/referral/link', token);

                if (!res.ok) {
                    const text = await res.text().catch(() => '');
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
                        получил бонусы <BlueStarIcon size={16} />
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
