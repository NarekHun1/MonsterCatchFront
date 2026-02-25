import { useEffect, useRef, useState } from 'react';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';
import { apiFetch } from './api';
import { Address } from '@ton/core';
import { TonActivationModal } from "./TonActivationModal";
import './Wallet.css';

type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

interface WithdrawalItem {
    id: number;
    createdAt: string;
    coins: number;
    amountUsd: number;
    amountTon: number | null;
    currency: string;
    network: string;
    address: string;
    status: WithdrawalStatus;
    txHash: string | null;
}

interface WalletInfo {
    coins: number;
    usdBalance: number;         // пусть приходит с бэка — просто не показываем
    coinPriceUsd: number;       // нужно для minCoins
    usdtAddress?: string | null; // пусть приходит — просто не показываем UI
    tonAddress?: string | null;
    withdrawals: WithdrawalItem[] | null;
}

interface WalletProps {
    token: string;
    onBack: () => void;
}

export function Wallet({ token, onBack }: WalletProps) {
    const [info, setInfo] = useState<WalletInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState<string | null>(null);

    const [withdrawCoins, setWithdrawCoins] = useState('');
    const [withdrawLoading, setWithdrawLoading] = useState(false);

    const [showActivation, setShowActivation] = useState(false);

    const wallet = useTonWallet();
    const tonSent = useRef(false);

    // -------------------------------------
    // LOAD INFO
    // -------------------------------------
    const loadInfo = () => {
        setLoading(true);
        setError('');
        apiFetch('/wallet/info', token)
            .then(async (res) => {
                const raw = await res.text();
                try {
                    const json = JSON.parse(raw);
                    if (!res.ok) throw new Error(json.message || 'Ошибка загрузки');
                    return json as WalletInfo;
                } catch {
                    console.error('Invalid JSON from /wallet/info:', raw);
                    throw new Error('Ошибка ответа сервера');
                }
            })
            .then((data) => {
                setInfo(data);
            })
            .catch((e: any) => {
                setError(e.message || 'Ошибка загрузки');
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (token) loadInfo();
    }, [token]);

    // -------------------------------------
    // AUTO-SAVE TON ADDRESS FROM TONCONNECT
    // -------------------------------------
    useEffect(() => {
        if (!wallet || !token || tonSent.current) return;

        const raw = wallet?.account?.address;
        if (!raw) return;

        let friendly = '';
        try {
            friendly = Address.parse(raw).toString({ bounceable: true });
        } catch {
            try {
                friendly = Address.parseRaw(raw).toString({ bounceable: true });
            } catch {
                console.error('TON address parsing failed');
                return;
            }
        }

        if (info?.tonAddress === friendly) return;

        tonSent.current = true;

        (async () => {
            try {
                const res = await apiFetch('/wallet/addresses', token, {
                    method: 'POST',
                    body: JSON.stringify({ tonAddress: friendly }),
                });

                await res.json().catch(() => ({}));
                if (!res.ok) return;

                setInfo((prev) => (prev ? { ...prev, tonAddress: friendly } : prev));
                setMessage('TON кошелёк подключён ✅');
            } catch (e) {
                console.error('TON SAVE ERROR:', e);
            }
        })();
    }, [wallet, token, info?.tonAddress]);

    // -------------------------------------
    // CREATE WITHDRAW REQUEST (TON ONLY)
    // -------------------------------------
    const handleWithdraw = async () => {
        if (!info) return;

        setWithdrawLoading(true);
        setMessage(null);
        setError('');

        try {
            const coins = Number(withdrawCoins);
            if (!coins || coins <= 0) throw new Error('Некорректное число монет');
            if (coins > info.coins) throw new Error('Недостаточно монет');

            const coinPrice = info.coinPriceUsd || 0;
            const minCoins = coinPrice > 0 ? Math.ceil(1 / coinPrice) : 0;
            if (coins < minCoins) throw new Error(`Минимум: ${minCoins} монет`);

            const res = await apiFetch('/wallet/withdraw', token, {
                method: 'POST',
                body: JSON.stringify({
                    coins,
                    currency: 'TON',
                    network: 'TON',
                    addressType: 'SAVED',
                }),
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.message || 'Ошибка вывода');

            setMessage(`Заявка создана ✅ ID #${json.id}`);
            setWithdrawCoins('');
            loadInfo();
        } catch (e: any) {
            const msg = e?.message || '';

            if (msg === 'TON_WALLET_NOT_ACTIVATED') {
                setShowActivation(true);
                return;
            }
            if (msg === 'TON_ADDRESS_NOT_SET') {
                setError('Сначала подключите TON-кошелёк через TonConnect.');
                return;
            }
            if (msg === 'CANNOT_WITHDRAW_TO_SAME_WALLET') {
                setError('Нельзя выводить TON на кошелёк выплаты проекта.');
                return;
            }
            if (msg === 'MIN_WITHDRAW_1_USD') {
                setError('Минимальная сумма вывода — 1$.');
                return;
            }

            setError(msg || 'Ошибка');
        } finally {
            setWithdrawLoading(false);
        }
    };

    const minCoins =
        info && info.coinPriceUsd > 0 ? Math.ceil(1 / info.coinPriceUsd) : 0;

    // -------------------------------------
    // UI
    // -------------------------------------
    return (
        <div className="panel wallet-root">
            <button className="back-btn" onClick={onBack}>⬅ Назад</button>

            <div className="wallet-title">
                <div className="wallet-title-emoji">👛</div>
                <div>
                    <h2 className="panel-title" style={{ marginBottom: 2 }}>Кошелёк</h2>
                    <div className="wallet-subtitle">TON · вывод монет</div>
                </div>
            </div>

            {loading && <p className="panel-muted">Загрузка...</p>}
            {error && <p className="panel-error">{error}</p>}
            {message && <p className="panel-success">{message}</p>}

            {info && (
                <>
                    {/* BALANCE CARD (только монеты, без $) */}
                    <div className="wallet-balance-card">
                        <div className="wallet-balance-left">
                            <div className="wallet-balance-label">Ваш баланс</div>
                            <div className="wallet-balance-coins">{info.coins} <span>🪙</span></div>
                            <div className="wallet-balance-hint">Можно вывести в TON</div>
                        </div>
                        <div className="wallet-balance-right">
                            <div className="wallet-badge">TON</div>
                        </div>
                    </div>

                    {/* TON CONNECT */}
                    <div className="wallet-card">
                        <div className="wallet-card-head">
                            <div className="wallet-card-title">🔗 TonConnect</div>
                            <div className="wallet-card-desc">Подключи кошелёк для вывода</div>
                        </div>

                        <div className="wallet-ton-btn">
                            <TonConnectButton />
                        </div>

                        <div className="wallet-addr">
                            {info.tonAddress ? (
                                <>
                                    <div className="wallet-addr-label">Подключён:</div>
                                    <div className="wallet-addr-value">
                                        {info.tonAddress.slice(0, 6)}…{info.tonAddress.slice(-4)}
                                    </div>
                                </>
                            ) : (
                                <div className="wallet-addr-empty">Кошелёк не подключён</div>
                            )}
                        </div>
                    </div>

                    {/* WITHDRAW */}
                    <div className="wallet-card">
                        <div className="wallet-card-head">
                            <div className="wallet-card-title">💸 Вывод в TON</div>
                            <div className="wallet-card-desc">
                                Минимум: <b>{minCoins}</b> монет
                            </div>
                        </div>

                        <div className="wallet-form">
                            <label className="wallet-label">Монеты</label>
                            <input
                                type="number"
                                className="wallet-input"
                                value={withdrawCoins}
                                onChange={(e) => setWithdrawCoins(e.target.value)}
                                placeholder={`${minCoins}+`}
                            />
                            <input
                                type="number"
                                className="wallet-input"
                                value={withdrawCoins}
                                onChange={(e) => setWithdrawCoins(e.target.value)}
                                placeholder={`${minCoins}+`}
                            />
                            {/* Preview: сколько это в $ */}
                            {(() => {
                                const c = Number(withdrawCoins);
                                if (!info || !c || c <= 0) return null;

                                const usd = c * (info.coinPriceUsd || 0);
                                return (
                                    <div className="wallet-preview">
                                        ≈ <b>{usd.toFixed(2)} $</b>
                                        <span className="wallet-preview-muted">
        {' '}({c} 🪙 × {(info.coinPriceUsd || 0).toFixed(4)}$)
      </span>
                                    </div>
                                );
                            })()}
                            <button
                                className="menu-btn"
                                disabled={withdrawLoading}
                                onClick={handleWithdraw}
                            >
                                {withdrawLoading ? 'Отправка...' : 'Создать заявку'}
                            </button>

                            <div className="wallet-mini-hint">
                                * Заявки проверяются вручную
                            </div>
                        </div>
                    </div>

                    {/* HISTORY */}
                    <div className="wallet-card">
                        <div className="wallet-card-head">
                            <div className="wallet-card-title">📜 История выводов</div>
                            <div className="wallet-card-desc">Последние заявки</div>
                        </div>

                        {!info.withdrawals || info.withdrawals.length === 0 ? (
                            <p className="panel-muted">Пусто</p>
                        ) : (
                            <div className="wallet-history">
                                {info.withdrawals.map((w) => (
                                    <div key={w.id} className="wallet-history-item">
                                        <div className="wh-top">
                                            <div className="wh-title">#{w.id} · {w.coins} 🪙</div>
                                            <span className={`wallet-status wallet-status--${w.status.toLowerCase()}`}>
                        {w.status}
                      </span>
                                        </div>

                                        <div className="wh-row">
                                            <span className="wh-muted">Сеть:</span> {w.network}
                                        </div>
                                        <div className="wh-row">
                                            <span className="wh-muted">Адрес:</span> {w.address.slice(0, 6)}…{w.address.slice(-4)}
                                        </div>

                                        {w.txHash && (
                                            <div className="wh-row">
                                                <span className="wh-muted">TX:</span> {w.txHash.slice(0, 8)}…{w.txHash.slice(-6)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {showActivation && info?.tonAddress && (
                <TonActivationModal
                    address={info.tonAddress}
                    onClose={() => setShowActivation(false)}
                />
            )}
        </div>
    );
}