// src/InviteFriends.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from './api';
import './inviteFrend.css'

interface InviteFriendsProps {
    token: string;
    onBack: () => void;
}

export const InviteFriends: React.FC<InviteFriendsProps> = ({ token, onBack }) => {
    const [link, setLink] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadReferralLink() {
            try {
                setLoading(true);
                setError(null);

                const res = await apiFetch('/referral/link', token);
                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    const msg = data?.message || 'Не удалось получить реферальную ссылку. Попробуй позже.';
                    if (!cancelled) setError(msg);
                    return;
                }

                if (!data?.link) {
                    if (!cancelled) setError('Сервер не вернул ссылку. Попробуй позже.');
                    return;
                }

                if (!cancelled) setLink(data.link);
            } catch (e) {
                console.error('Referral link fetch failed', e);
                if (!cancelled) setError('Ошибка соединения с сервером.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadReferralLink();
        return () => {
            cancelled = true;
        };
    }, [token]);

    const shareText = useMemo(() => {
        // 🔥 Чётко объясняем награду
        return (
            '👾 Monster Catch — залетай!\n\n' +
            '🎁 Если ты зайдёшь по моей ссылке и сыграешь 1 игру до конца — ' +
            'я получу 🎟 +5 билетов.\n\n' +
            'Поехали ловить монстров 😈'
        );
    }, []);

    const handleShare = () => {
        if (!link) return;

        const tg = (window as any).Telegram?.WebApp;

        // Telegram share link (без фото — это ограничение Telegram)
        const shareUrl =
            `https://t.me/share/url?url=${encodeURIComponent(link)}` +
            `&text=${encodeURIComponent(shareText)}`;

        tg?.HapticFeedback?.impactOccurred?.('light');

        if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl);
        else window.open(shareUrl, '_blank');
    };

    const handleCopy = async () => {
        if (!link) return;

        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');
            setTimeout(() => setCopied(false), 1200);
        } catch {
            (window as any).Telegram?.WebApp?.showAlert?.('Не удалось скопировать ссылку');
        }
    };

    return (
        <div className="panel panel-menu">
            <h2 className="panel-title">Пригласить друга</h2>

            {/* ✅ КАРТИНКА-ПРЕВЬЮ ВНУТРИ WEBAPP */}
            <div className="referral-preview">
                <img className="referral-preview-img" src="/monster.jpeg" alt="Monster Catch" />
                <div className="referral-preview-info">
                    <div className="referral-preview-title">🎁 Бонус за друга</div>
                    <div className="referral-preview-sub">
                        Ты получишь <b>5 🎟 билетов</b>, когда друг зайдёт по ссылке и
                        <b> завершит 1 игру</b>.
                    </div>
                </div>
            </div>

            {loading && <p className="panel-muted">Загружаем твою ссылку…</p>}

            {!loading && error && <p className="panel-muted">{error}</p>}

            {!loading && !error && (
                <>
                    <p className="panel-muted">
                        Отправь ссылку друзьям. После первой завершённой игры друга ты получишь бонусы{' '}
                         (и 🎟 билеты).
                    </p>

                    <div className="referral-box" onClick={handleCopy} role="button" tabIndex={0}>
                        <span className="referral-link">{link}</span>
                        <span className="referral-copy">{copied ? '✅ Скопировано' : '📋 Копировать'}</span>
                    </div>

                    <button className="menu-btn" onClick={handleShare}>
                        📤 Отправить другу в Telegram
                    </button>

                    <button className="menu-btn menu-btn--secondary" onClick={handleCopy}>
                        🔗 Скопировать ссылку
                    </button>
                </>
            )}

            <button className="menu-card" onClick={onBack}>
                ⬅️ Назад в меню
            </button>
        </div>
    );
};
