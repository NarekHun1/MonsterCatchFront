import { useState } from 'react';
import {BlueStarIcon} from "./styles/BlueStarIcon.tsx";

interface Props {
    stars: number;
    token: string;
    onStarsChange: (stars: number) => void;
}

export function ExchangeTicket({
                                   stars,
                                   token,
                                   onStarsChange,
                               }: Props) {
    const COST = 100;
    const [loading, setLoading] = useState(false);

    const missing = Math.max(0, COST - stars);

    async function exchange() {
        if (!missing || loading) return;

        setLoading(true);

        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_BASE_URL}/tickets/exchange-stars`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            );

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.message || 'Ошибка обмена');
            }

            // обновляем stars в App.tsx
            onStarsChange(data.starsLeft);

            // Telegram UX
            (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred(
                'success',
            );
        } catch (e: any) {
            (window as any).Telegram?.WebApp?.showAlert?.(
                e.message || 'Ошибка обмена',
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            className="menu-card"
            disabled={!missing || loading}
            onClick={exchange}
        >
            <div className="menu-icon">🎟</div>
            <div className="menu-card-title">Турнирный билет</div>

            <div className="menu-card-text">
                {loading ? (
                    '⏳ Обмен...'
                ) : missing ? (
                    <>
                        Обменять {COST} <BlueStarIcon size={16}/> на билет
                    </>
                ) : (
                    <>
                        Нужно ещё {missing} <BlueStarIcon size={16}/>
                    </>
                )}
            </div>
        </button>

    );
}
