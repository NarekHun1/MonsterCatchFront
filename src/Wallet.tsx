// src/Wallet.tsx
import { useEffect, useState } from 'react';
import { apiFetch } from './api';

type Currency = 'USDT' | 'TON';

interface WalletProps {
    token: string;
    onBack?: () => void;
}

export function Wallet({ token, onBack }: WalletProps) {
    const [coins, setCoins] = useState(0);
    const [usdPerCoin, setUsdPerCoin] = useState(0.02); // пример: 1 coin = $0.02 (50 coins = $1)
    const [tonAddress, setTonAddress] = useState('');
    const [usdtAddress, setUsdtAddress] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<Currency>('USDT');
    const [loading, setLoading] = useState(true);
    const [savingAddress, setSavingAddress] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // 🚀 грузим данные кошелька
    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                setLoading(true);
                setError(null);

                // 👉 примерный эндпоинт, его нужно сделать на бэкенде
                const res = await apiFetch('/wallet/balance', token);
                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    throw new Error(data.message || 'Не удалось загрузить кошелёк');
                }

                if (cancelled) return;

                setCoins(data.coins ?? 0);
                setUsdPerCoin(data.usdPerCoin ?? 0.02);
                setTonAddress(data.tonAddress ?? '');
                setUsdtAddress(data.usdtAddress ?? '');
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
    const withdrawUsd = Number(amount || 0) * usdPerCoin;

    const handleSaveAddress = async () => {
        try {
            setSavingAddress(true);
            setMessage(null);
            setError(null);

            const res = await apiFetch('/wallet/address', token, {
                method: 'POST',
                body: JSON.stringify({
                    tonAddress,
                    usdtAddress,
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || 'Не удалось сохранить адреса');
            }

            setMessage('Адреса сохранены ✅');
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Ошибка сохранения адресов');
        } finally {
            setSavingAddress(false);
        }
    };

    const handleWithdraw = async () => {
        const amountNum = Number(amount);
        if (!amountNum || amountNum <= 0) {
            setError('Введи корректное количество монет');
            return;
        }
        if (amountNum > coins) {
            setError('У тебя нет столько монет 😢');
            return;
        }

        if (currency === 'TON' && !tonAddress) {
            setError('Сначала укажи TON-кошелёк');
            return;
        }
        if (currency === 'USDT' && !usdtAddress) {
            setError('Сначала укажи USDT-кошелёк');
            return;
        }

        try {
            setWithdrawing(true);
            setMessage(null);
            setError(null);

            const res = await apiFetch('/wallet/withdraw', token, {
                method: 'POST',
                body: JSON.stringify({
                    amountCoins: amountNum,
                    currency,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.message || 'Не удалось создать заявку на вывод');
            }

            setMessage('Заявка на вывод создана ✅ Мы обработаем её в ближайшее время.');
            setCoins(data.coins ?? coins - amountNum);
            setAmount('');
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Ошибка создания заявки на вывод');
        } finally {
            setWithdrawing(false);
        }
    };

    const openTonWallets = () => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.openLink) {
            tg.openLink('https://ton.app/wallets');
        } else {
            window.open('https://ton.app/wallets', '_blank');
        }
    };

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

            {!loading && (
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

                    <div className="wallet-section">
                        <h3 className="wallet-section-title">Адреса для вывода</h3>

                        <label className="wallet-label">TON адрес</label>
                        <input
                            className="wallet-input"
                            placeholder="UQ... (TON кошелёк)"
                            value={tonAddress}
                            onChange={(e) => setTonAddress(e.target.value)}
                        />

                        <button className="wallet-small-btn" onClick={openTonWallets}>
                            🔗 Открыть список TON-кошельков
                        </button>

                        <label className="wallet-label">USDT (например TRC20)</label>
                        <input
                            className="wallet-input"
                            placeholder="Адрес USDT (TRC20 / ERC20 и т.п.)"
                            value={usdtAddress}
                            onChange={(e) => setUsdtAddress(e.target.value)}
                        />

                        <button
                            className="menu-btn"
                            onClick={handleSaveAddress}
                            disabled={savingAddress}
                        >
                            {savingAddress ? 'Сохраняем...' : '💾 Сохранить адреса'}
                        </button>
                    </div>

                    <div className="wallet-section">
                        <h3 className="wallet-section-title">Вывести награду</h3>

                        <label className="wallet-label">Сколько монет вывести</label>
                        <input
                            className="wallet-input"
                            type="number"
                            min={0}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Например, 50"
                        />

                        <div className="wallet-withdraw-row">
                            <div className="wallet-radio-group">
                                <button
                                    className={`wallet-radio ${currency === 'USDT' ? 'wallet-radio--active' : ''}`}
                                    onClick={() => setCurrency('USDT')}
                                >
                                    💵 Вывод в USDT
                                </button>
                                <button
                                    className={`wallet-radio ${currency === 'TON' ? 'wallet-radio--active' : ''}`}
                                    onClick={() => setCurrency('TON')}
                                >
                                    🔷 Вывод в TON
                                </button>
                            </div>
                            <div className="wallet-withdraw-hint">
                                ≈ {withdrawUsd.toFixed(2)} $
                            </div>
                        </div>

                        <button
                            className="menu-btn"
                            disabled={withdrawing}
                            onClick={handleWithdraw}
                        >
                            {withdrawing ? 'Отправляем заявку...' : '📤 Создать заявку на вывод'}
                        </button>
                    </div>

                    {message && (
                        <p className="wallet-message">
                            {message}
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
