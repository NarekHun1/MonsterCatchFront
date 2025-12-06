// src/Wallet.tsx
import { useEffect, useState } from 'react';
import { apiFetch } from './api';

interface WalletProps {
    token: string;
    onBack?: () => void;
}

export function Wallet({ token, onBack }: WalletProps) {
    const [coins, setCoins] = useState(0);
    const [usdPerCoin] = useState(0.02); // пример: 1 coin = $0.02 => 50 coins ≈ $1
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                setLoading(true);
                setError(null);

                // ✅ уже существующий эндпоинт
                const res = await apiFetch('/users/me', token);
                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    throw new Error(data.message || 'Не удалось загрузить профиль');
                }

                if (cancelled) return;

                setCoins(data.coins ?? 0);
            } catch (e: any) {
                if (cancelled) return;
                console.error(e);
                setError(e.message || 'Ошибка загрузки кошелька');
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [token]);

    const totalUsd = coins * usdPerCoin;

    return (
        <div className="panel">
            <div className="wallet-header">
                {onBack && (
                    <button className="wallet-back-btn" onClick={onBack}>
                        ← Назад
                    </button>
                )}
                <h2 className="panel-title">👛 Кошелёк</h2>
            </div>

            {loading && <p className="panel-muted">Загружаем кошелёк...</p>}

            {error && (
                <p className="panel-error" style={{ marginBottom: 16 }}>
                    {error}
                </p>
            )}

            {!loading && !error && (
                <>
                    <div className="wallet-balance">
                        <div className="wallet-balance-row">
                            <span>Твой баланс:</span>
                            <span className="wallet-balance-main">{coins} 🪙</span>
                        </div>
                        <div className="wallet-balance-sub">
                            ~ {totalUsd.toFixed(2)} $ по курсу {usdPerCoin.toFixed(2)} $ за 1 монету
                        </div>
                    </div>

                    <p className="panel-muted">
                        Здесь позже добавим вывод в USDT / TON и привязку кошельков Binance / TON-кошельков.
                    </p>
                </>
            )}
        </div>
    );
}
