// src/Wallet.tsx
import { useEffect, useRef, useState } from 'react';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';
import { apiFetch } from './api';
import { Address } from '@ton/core';
import { TonActivationModal } from "./TonActivationModal.tsx";

type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
type WithdrawalCurrency = 'USDT' | 'TON';

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
    usdBalance: number;
    coinPriceUsd: number;
    usdtAddress?: string | null;
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
    const [usdtAddress, setUsdtAddress] = useState('');
    const [linkLoading, setLinkLoading] = useState(false);
    const [linkMessage, setLinkMessage] = useState<string | null>(null);

    const [withdrawCurrency, setWithdrawCurrency] =
        useState<WithdrawalCurrency>('USDT');
    const [withdrawCoins, setWithdrawCoins] = useState('');
    const [withdrawLoading, setWithdrawLoading] = useState(false);
    const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);
    const [showActivation, setShowActivation] = useState(false);

    const wallet = useTonWallet();
    const tonSent = useRef(false);

    // -------------------------------------
    // LOAD INFO
    // -------------------------------------
    const loadInfo = () => {
        setLoading(true);
        apiFetch('/wallet/info', token)
            .then(async (res) => {
                const raw = await res.text();

                try {
                    const json = JSON.parse(raw);
                    if (!res.ok) throw new Error(json.message || 'Ошибка загрузки');
                    return json as WalletInfo;
                } catch (e) {
                    console.error("Invalid JSON from /wallet/info:", raw);
                    throw new Error("Ошибка ответа сервера");
                }
            })
            .then((data) => {
                setInfo(data);
                setUsdtAddress(data.usdtAddress ?? '');
            })
            .catch((e: any) => {
                console.error("LOAD INFO ERROR:", e);
                setError(e.message);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (token) loadInfo();
    }, [token]);

    // -------------------------------------
    // SAVE USDT ADDRESS
    // -------------------------------------
    const handleLinkUsdt = async () => {
        setError('');
        setLinkMessage(null);
        setLinkLoading(true);

        try {
            const addr = usdtAddress.trim();
            if (!addr) throw new Error('Введите адрес USDT');

            if (!addr.startsWith("T"))
                throw new Error("TRC20 адрес должен начинаться с T");

            const res = await apiFetch('/wallet/addresses', token, {
                method: 'POST',
                body: JSON.stringify({ usdtAddress: addr })
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Ошибка сохранения');

            setLinkMessage('USDT кошелёк сохранён!');
            setInfo((prev) => prev ? { ...prev, usdtAddress: addr } : prev);

        } catch (e: any) {
            setError(e.message);
        } finally {
            setLinkLoading(false);
        }
    };

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
                console.error("TON address parsing failed");
                return;
            }
        }

        if (info?.tonAddress === friendly) return;

        tonSent.current = true;

        (async () => {
            try {
                const res = await apiFetch('/wallet/addresses', token, {
                    method: 'POST',
                    body: JSON.stringify({ tonAddress: friendly })
                });

                await res.json().catch(() => ({}));
                if (!res.ok) return;

                setInfo((prev) => prev ? { ...prev, tonAddress: friendly } : prev);
                setLinkMessage('TON кошелёк подключён!');
            } catch (e) {
                console.error("TON SAVE ERROR:", e);
            }
        })();

    }, [wallet, token, info?.tonAddress]);

    // -------------------------------------
    // CREATE WITHDRAW REQUEST
    // -------------------------------------
    const handleWithdraw = async () => {
        if (!info) return;

        setWithdrawLoading(true);
        setWithdrawMessage(null);
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
                    currency: withdrawCurrency,
                    network: withdrawCurrency === 'USDT' ? 'TRC20' : 'TON',
                    addressType: 'SAVED'
                })
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.message || 'Ошибка вывода');

            setWithdrawMessage(`Заявка создана! ID #${json.id}`);
            setWithdrawCoins('');
            loadInfo();

        } catch (e: any) {
            const msg = e?.message || "";

            if (msg === "TON_WALLET_NOT_ACTIVATED") {
                setShowActivation(true);
                return;
            }


            if (msg === "TON_ADDRESS_NOT_SET") {
                setError("Сначала подключите TON-кошелёк через TonConnect.");
                return;
            }

            if (msg === "CANNOT_WITHDRAW_TO_SAME_WALLET") {
                setError("Нельзя выводить TON на кошелёк выплаты проекта.");
                return;
            }

            if (msg === "MIN_WITHDRAW_1_USD") {
                setError("Минимальная сумма вывода — 1$.");
                return;
            }

            setError(msg);
        } finally {
            setWithdrawLoading(false);
        }
    };

    const minCoins = info && info.coinPriceUsd > 0
        ? Math.ceil(1 / info.coinPriceUsd)
        : 0;

    // -------------------------------------
    // RENDER
    // -------------------------------------
    return (
        <div className="panel">
            <button className="back-btn" onClick={onBack}>⬅ Назад</button>

            <h2 className="panel-title">👛 Кошелёк</h2>

            {loading && <p>Загрузка...</p>}
            {error && <p className="panel-error">{error}</p>}
            {linkMessage && <p className="panel-success">{linkMessage}</p>}
            {withdrawMessage && <p className="panel-success">{withdrawMessage}</p>}

            {info && (
                <>
                    <div className="wallet-balance-box">
                        <div className="wallet-balance-main">
                            <span className="wallet-balance-value">{info.coins} 🪙</span>
                            <div>~ {(info.usdBalance ?? 0).toFixed(2)} $</div>
                        </div>
                    </div>

                    <div className="wallet-section">
                        <h3>🔗 TON Connect</h3>
                        <TonConnectButton />
                        {wallet && (
                            <p className="wallet-hint">
                                Подключен: {wallet.account.address.slice(0, 6)}...
                                {wallet.account.address.slice(-4)}
                            </p>
                        )}
                    </div>

                    <div className="wallet-section">
                        <h3>💳 USDT кошелёк</h3>
                        <input
                            className="wallet-input"
                            value={usdtAddress}
                            onChange={(e) => setUsdtAddress(e.target.value)}
                            placeholder="TRC20 адрес"
                        />
                        <button className="menu-btn" onClick={handleLinkUsdt}>
                            {linkLoading ? 'Сохраняем...' : 'Сохранить адрес'}
                        </button>
                    </div>

                    <div className="wallet-section">
                        <h3>💸 Вывод</h3>

                        <label>Монеты</label>
                        <input
                            type="number"
                            className="wallet-input"
                            value={withdrawCoins}
                            onChange={(e) => setWithdrawCoins(e.target.value)}
                            placeholder={`${minCoins}+`}
                        />

                        <div className="wallet-tabs">
                            <button
                                className={withdrawCurrency === 'USDT' ? 'wallet-tab--active' : 'wallet-tab'}
                                onClick={() => setWithdrawCurrency('USDT')}
                            >
                                USDT
                            </button>
                            <button
                                className={withdrawCurrency === 'TON' ? 'wallet-tab--active' : 'wallet-tab'}
                                onClick={() => setWithdrawCurrency('TON')}
                            >
                                TON
                            </button>
                        </div>

                        <button className="menu-btn" disabled={withdrawLoading} onClick={handleWithdraw}>
                            {withdrawLoading ? 'Отправка...' : 'Создать заявку'}
                        </button>
                    </div>

                    <div className="wallet-section">
                        <h3>📜 История выводов</h3>

                        {!info.withdrawals || info.withdrawals.length === 0 && <p>Пусто</p>}

                        {info.withdrawals && info.withdrawals.map((w) => (
                            <div key={w.id} className="wallet-history-item">
                                <div>{w.coins} → {w.amountUsd.toFixed(2)} USD ({w.currency})</div>
                                <div>Сеть: {w.network}</div>
                                <div>Адрес: {w.address.slice(0, 6)}...{w.address.slice(-4)}</div>

                                <span className={`wallet-status wallet-status--${w.status.toLowerCase()}`}>
                                    {w.status}
                                </span>
                            </div>
                        ))}
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
