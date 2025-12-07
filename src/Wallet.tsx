// src/Wallet.tsx
import { useEffect, useState } from 'react';
import { apiFetch } from './api';

type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
type WithdrawalCurrency = 'USDT' | 'TON';

interface WalletInfo {
    coins: number;
    approxUsd: number;
    coinPriceUsd: number;
    minWithdrawUsd: number;
    minWithdrawCoins: number;
    usdtAddress?: string | null;
    tonAddress?: string | null;
    recentWithdrawals: {
        id: number;
        createdAt: string;
        coinsAmount: number;
        usdAmount: number;
        currency: WithdrawalCurrency;
        status: WithdrawalStatus;
        txHash?: string | null;
    }[];
}

interface WalletProps {
    token: string;
    onBack: () => void;
}

export function Wallet({ token, onBack }: WalletProps) {
    const [info, setInfo] = useState<WalletInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [usdtAddress, setUsdtAddress] = useState('');
    const [tonAddress, setTonAddress] = useState('');

    const [linkLoading, setLinkLoading] = useState(false);
    const [linkMessage, setLinkMessage] = useState<string | null>(null);

    const [withdrawCurrency, setWithdrawCurrency] =
        useState<WithdrawalCurrency>('USDT');
    const [withdrawCoins, setWithdrawCoins] = useState('');
    const [withdrawLoading, setWithdrawLoading] = useState(false);
    const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);

    const loadInfo = () => {
        setLoading(true);
        setError('');
        apiFetch('/wallet/info', token)
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data.message || 'Не удалось загрузить кошелёк');
                }
                return data as WalletInfo;
            })
            .then((data) => {
                setInfo(data);
                setUsdtAddress(data.usdtAddress ?? '');
                setTonAddress(data.tonAddress ?? '');
            })
            .catch((e: any) => {
                console.error(e);
                setError(e.message || 'Ошибка кошелька');
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (!token) return;
        loadInfo();
    }, [token]);

    const handleLink = async (type: 'USDT' | 'TON') => {
        setLinkMessage(null);
        setError('');
        setLinkLoading(true);
        try {
            const address = type === 'USDT' ? usdtAddress : tonAddress;

            const res = await apiFetch('/wallet/link-address', token, {
                method: 'POST',
                body: JSON.stringify({ type, address }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || 'Не удалось сохранить адрес');
            }
            setLinkMessage('Адрес успешно сохранён ✅');
            setInfo((prev) =>
                prev
                    ? {
                        ...prev,
                        usdtAddress: data.usdtAddress ?? prev.usdtAddress,
                        tonAddress: data.tonAddress ?? prev.tonAddress,
                    }
                    : prev,
            );
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Ошибка при сохранении адреса');
        } finally {
            setLinkLoading(false);
        }
    };

    const handleWithdraw = async () => {
        if (!info) return;

        setWithdrawMessage(null);
        setError('');
        setWithdrawLoading(true);

        try {
            const amountCoins = Number(withdrawCoins);
            if (!amountCoins || amountCoins <= 0) {
                throw new Error('Укажи корректное количество монет');
            }

            const res = await apiFetch('/wallet/withdraw', token, {
                method: 'POST',
                body: JSON.stringify({
                    currency: withdrawCurrency,
                    coinsAmount: amountCoins,
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(
                    data.message ||
                    'Не удалось создать заявку на вывод (проверь минимальную сумму).',
                );
            }

            setWithdrawMessage(
                `Заявка на вывод создана! Мы обработаем её вручную. ID #${data.withdrawalId}`,
            );
            setWithdrawCoins('');

            // обновляем баланс и историю
            loadInfo();
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Ошибка при создании заявки');
        } finally {
            setWithdrawLoading(false);
        }
    };

    const currentCoins = info?.coins ?? 0;
    const approxUsd = info?.approxUsd ?? 0;
    const price = info?.coinPriceUsd ?? 0;
    const minCoins = info?.minWithdrawCoins ?? 0;
    const minUsd = info?.minWithdrawUsd ?? 0;

    return (
        <div className="panel">
            <button className="back-btn" onClick={onBack}>
                ⬅ Назад
            </button>

            <h2 className="panel-title">👛 Кошелёк</h2>

            {loading && <p className="panel-muted">Загружаем кошелёк...</p>}
            {error && <p className="panel-error">Ошибка: {error}</p>}
            {linkMessage && <p className="panel-success">{linkMessage}</p>}
            {withdrawMessage && (
                <p className="panel-success">{withdrawMessage}</p>
            )}

            {info && (
                <>
                    {/* БАЛАНС */}
                    <div className="wallet-balance-box">
                        <div className="wallet-balance-main">
                            <div className="wallet-balance-coins">
                                <span className="wallet-balance-label">Твой баланс</span>
                                <span className="wallet-balance-value">
                  {currentCoins} 🪙
                </span>
                            </div>
                            <div className="wallet-balance-usd">
                                ~ {approxUsd.toFixed(2)} $ при курсе{' '}
                                {price.toFixed(2)} $ за 1 монету
                            </div>
                        </div>
                        <p className="panel-muted wallet-balance-note">
                            Монеты ты зарабатываешь в турнирах и покупаешь через Telegram
                            Stars. Здесь ты можешь вывести их в крипту.
                        </p>
                    </div>

                    {/* ПРИВЯЗКА КОШЕЛЬКОВ */}
                    <div className="wallet-section">
                        <h3 className="panel-subtitle">🔗 Привязка кошельков</h3>

                        <div className="wallet-field">
                            <label className="wallet-label">
                                USDT-адрес (например, TRC20 / ERC20)
                            </label>
                            <input
                                className="wallet-input"
                                value={usdtAddress}
                                onChange={(e) => setUsdtAddress(e.target.value)}
                                placeholder="Адрес кошелька USDT"
                            />
                            <button
                                className="menu-btn menu-btn--secondary"
                                disabled={linkLoading}
                                onClick={() => handleLink('USDT')}
                            >
                                Сохранить USDT-адрес
                            </button>
                        </div>

                        <div className="wallet-field">
                            <label className="wallet-label">
                                TON-кошелёк (например, Tonkeeper / Telegram Wallet)
                            </label>
                            <input
                                className="wallet-input"
                                value={tonAddress}
                                onChange={(e) => setTonAddress(e.target.value)}
                                placeholder="Адрес TON-кошелька"
                            />
                            <button
                                className="menu-btn menu-btn--secondary"
                                disabled={linkLoading}
                                onClick={() => handleLink('TON')}
                            >
                                Сохранить TON-адрес
                            </button>
                        </div>
                    </div>

                    {/* ВЫВОД СРЕДСТВ */}
                    <div className="wallet-section">
                        <h3 className="panel-subtitle">💸 Запросить вывод</h3>
                        <p className="panel-muted">
                            Минимум к выводу: {minCoins} монет (~{minUsd.toFixed(2)} $).
                            Заявка попадает в очередь и обрабатывается вручную.
                        </p>

                        <div className="wallet-withdraw-grid">
                            <div className="wallet-field">
                                <label className="wallet-label">Сколько монет вывести</label>
                                <input
                                    className="wallet-input"
                                    type="number"
                                    min={0}
                                    value={withdrawCoins}
                                    onChange={(e) => setWithdrawCoins(e.target.value)}
                                    placeholder={`${minCoins} и больше`}
                                />
                                {withdrawCoins && (
                                    <div className="wallet-hint">
                                        ≈{' '}
                                        {(
                                            Number(withdrawCoins || 0) * (price || 0)
                                        ).toFixed(2)}{' '}
                                        $
                                    </div>
                                )}
                            </div>

                            <div className="wallet-field">
                                <label className="wallet-label">Куда вывести</label>
                                <div className="wallet-tabs">
                                    <button
                                        className={
                                            'wallet-tab' +
                                            (withdrawCurrency === 'USDT'
                                                ? ' wallet-tab--active'
                                                : '')
                                        }
                                        onClick={() => setWithdrawCurrency('USDT')}
                                    >
                                        USDT
                                    </button>
                                    <button
                                        className={
                                            'wallet-tab' +
                                            (withdrawCurrency === 'TON'
                                                ? ' wallet-tab--active'
                                                : '')
                                        }
                                        onClick={() => setWithdrawCurrency('TON')}
                                    >
                                        TON
                                    </button>
                                </div>
                                <div className="wallet-hint">
                                    {withdrawCurrency === 'USDT'
                                        ? info.usdtAddress
                                            ? `Будем отправлять на: ${info.usdtAddress}`
                                            : 'Сначала привяжи USDT-адрес выше.'
                                        : info.tonAddress
                                            ? `Будем отправлять на: ${info.tonAddress}`
                                            : 'Сначала привяжи TON-кошелёк выше.'}
                                </div>
                            </div>
                        </div>

                        <button
                            className="menu-btn"
                            disabled={withdrawLoading}
                            onClick={handleWithdraw}
                        >
                            {withdrawLoading ? 'Отправляем заявку...' : 'Создать заявку на вывод'}
                        </button>
                    </div>

                    {/* ИСТОРИЯ ВЫВОДОВ */}
                    <div className="wallet-section">
                        <h3 className="panel-subtitle">📜 Последние выводы</h3>
                        {info.recentWithdrawals.length === 0 ? (
                            <p className="panel-muted">
                                Ты ещё ни разу не запрашивал вывод. Всё впереди 😉
                            </p>
                        ) : (
                            <div className="wallet-history-list">
                                {info.recentWithdrawals.map((w) => (
                                    <div key={w.id} className="wallet-history-item">
                                        <div className="wallet-history-main">
                      <span>
                        {w.coinsAmount} 🪙 → {w.usdAmount.toFixed(2)} $ {w.currency}
                      </span>
                                            <span className={`wallet-status wallet-status--${w.status.toLowerCase()}`}>
                        {w.status === 'PENDING' && 'В ожидании'}
                                                {w.status === 'APPROVED' && 'Одобрено'}
                                                {w.status === 'PAID' && 'Выплачено'}
                                                {w.status === 'REJECTED' && 'Отклонено'}
                      </span>
                                        </div>
                                        <div className="wallet-history-sub">
                                            {new Date(w.createdAt).toLocaleString()}
                                            {w.txHash && (
                                                <span className="wallet-txhash">
                          · tx: {w.txHash.slice(0, 8)}...
                        </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
