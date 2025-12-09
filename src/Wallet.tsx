// src/Wallet.tsx
import { useEffect, useState } from 'react';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';
import { apiFetch } from './api';

type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
type WithdrawalCurrency = 'USDT' | 'TON';

interface WithdrawalItem {
    id: number;
    createdAt: string;
    coins: number;
    amountUsd: number;
    amountTon: number | null;
    currency: WithdrawalCurrency | string;
    network: string;
    address: string;
    status: WithdrawalStatus;
    txHash: string | null;
}

interface WalletInfo {
    coins: number;
    usdBalance: number;
    coinPriceUsd: number;
    usdtAddress?: string | null;
    tonAddress?: string | null;
    withdrawals: WithdrawalItem[];
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
    const [linkLoading, setLinkLoading] = useState(false);
    const [linkMessage, setLinkMessage] = useState<string | null>(null);

    const [withdrawCurrency, setWithdrawCurrency] =
        useState<WithdrawalCurrency>('USDT');
    const [withdrawCoins, setWithdrawCoins] = useState('');
    const [withdrawLoading, setWithdrawLoading] = useState(false);
    const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);

    const wallet = useTonWallet(); // TON Connect

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // 🔗 сохранение USDT-адреса вручную
    const handleLinkUsdt = async () => {
        setLinkMessage(null);
        setError('');
        setLinkLoading(true);
        try {
            const address = usdtAddress.trim();

            if (!address) {
                throw new Error('Введи адрес USDT-кошелька');
            }

            const res = await apiFetch('/wallet/addresses', token, {
                method: 'POST',
                body: JSON.stringify({ usdtAddress: address }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || 'Не удалось сохранить USDT-адрес');
            }

            setLinkMessage('USDT-адрес успешно сохранён ✅');
            setInfo((prev) =>
                prev
                    ? {
                        ...prev,
                        usdtAddress:
                            typeof data.usdtAddress !== 'undefined'
                                ? data.usdtAddress
                                : prev.usdtAddress,
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

    // 🔗 автоматическое сохранение TON-адреса при подключении кошелька
    useEffect(() => {
        if (!wallet || !token) return;

        const addr = wallet.account.address; // raw-адрес

        // если уже такой же адрес сохранён — ничего не делаем
        if (info?.tonAddress === addr) return;

        (async () => {
            try {
                const res = await apiFetch('/wallet/addresses', token, {
                    method: 'POST',
                    body: JSON.stringify({ tonAddress: addr }),
                });

                // просто проверяем статус, тело нам не нужно → без лишней переменной
                await res.json().catch(() => ({}));
                if (!res.ok) {
                    console.error('Не удалось сохранить TON-адрес');
                    return;
                }

                setInfo((prev) => (prev ? { ...prev, tonAddress: addr } : prev));
                setLinkMessage('TON-кошелёк подключён через TON Connect ✅');
            } catch (e) {
                console.error(e);
            }
        })();
    }, [wallet, token, info?.tonAddress]);

    // 💸 Создание заявки на вывод
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

            // минималка: 1$
            const minUsd = 1;
            const price = info.coinPriceUsd || 0.000001;
            const minCoins = Math.ceil(minUsd / price);

            if (amountCoins < minCoins) {
                throw new Error(
                    `Минимум к выводу: ${minCoins} монет (~${minUsd.toFixed(2)} $)`,
                );
            }

            const res = await apiFetch('/wallet/withdraw', token, {
                method: 'POST',
                body: JSON.stringify({
                    coins: amountCoins,
                    currency: withdrawCurrency,
                    network: withdrawCurrency === 'USDT' ? 'TRC20' : 'TON',
                    addressType: 'SAVED',
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
                `Заявка на вывод создана! ID #${data.id || data.withdrawalId}`,
            );
            setWithdrawCoins('');
            loadInfo();
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Ошибка при создании заявки');
        } finally {
            setWithdrawLoading(false);
        }
    };

    const currentCoins = info?.coins ?? 0;
    const approxUsd = info?.usdBalance ?? 0;
    const price = info?.coinPriceUsd ?? 0;

    const minUsd = 1;
    const minCoins = price > 0 ? Math.ceil(minUsd / price) : 0;

    return (
        <div className="panel">
            <button className="back-btn" onClick={onBack}>
                ⬅ Назад
            </button>

            <h2 className="panel-title">👛 Кошелёк</h2>

            {loading && <p className="panel-muted">Загружаем кошелёк...</p>}
            {error && <p className="panel-error">Ошибка: {error}</p>}
            {linkMessage && <p className="panel-success">{linkMessage}</p>}
            {withdrawMessage && <p className="panel-success">{withdrawMessage}</p>}

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
                            Stars. Здесь ты можешь запросить вывод в крипту.
                        </p>
                    </div>

                    {/* TON CONNECT */}
                    <div className="wallet-section">
                        <h3 className="panel-subtitle">🔗 TON Connect</h3>
                        <p className="panel-muted">
                            Подключи TON-кошелёк (Telegram Wallet, Tonkeeper, Tonhub и др.).
                            Мы автоматически используем этот адрес для вывода TON.
                        </p>

                        <div
                            className="wallet-tonconnect-box"
                            style={{ marginBottom: '16px' }}
                        >
                            <TonConnectButton />

                            {wallet && (
                                <p className="wallet-hint" style={{ marginTop: '8px' }}>
                                    Подключен кошелёк:{' '}
                                    {wallet.account.address.slice(0, 6)}...
                                    {wallet.account.address.slice(-4)}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ПРИВЯЗКА USDT-КОШЕЛЬКА */}
                    <div className="wallet-section">
                        <h3 className="panel-subtitle">💳 USDT-кошелёк</h3>

                        <div className="wallet-field">
                            <label className="wallet-label">
                                USDT-адрес (например, TRC20 / ERC20 / BEP20)
                            </label>
                            <input
                                className="wallet-input"
                                value={usdtAddress}
                                onChange={(e) => setUsdtAddress(e.target.value)}
                                placeholder="Адрес USDT-кошелька"
                            />
                            <button
                                className="menu-btn menu-btn--secondary"
                                disabled={linkLoading}
                                onClick={handleLinkUsdt}
                            >
                                {linkLoading ? 'Сохраняем...' : 'Сохранить USDT-адрес'}
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
                                            : 'Сначала подключи TON-кошелёк через TON Connect выше.'}
                                </div>
                            </div>
                        </div>

                        <button
                            className="menu-btn"
                            disabled={withdrawLoading}
                            onClick={handleWithdraw}
                        >
                            {withdrawLoading
                                ? 'Отправляем заявку...'
                                : 'Создать заявку на вывод'}
                        </button>
                    </div>

                    {/* ИСТОРИЯ ВЫВОДОВ */}
                    <div className="wallet-section">
                        <h3 className="panel-subtitle">📜 Последние выводы</h3>
                        {info.withdrawals.length === 0 ? (
                            <p className="panel-muted">
                                Ты ещё ни разу не запрашивал вывод. Всё впереди 😉
                            </p>
                        ) : (
                            <div className="wallet-history-list">
                                {info.withdrawals.map((w) => (
                                    <div key={w.id} className="wallet-history-item">
                                        <div className="wallet-history-main">
                      <span>
                        {w.coins} 🪙 → {w.amountUsd.toFixed(2)} $ {w.currency}
                      </span>
                                            <span
                                                className={`wallet-status wallet-status--${w.status.toLowerCase()}`}
                                            >
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
