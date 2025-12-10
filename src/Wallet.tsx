// src/Wallet.tsx
import { useEffect, useState } from 'react';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';
import { apiFetch } from './api';
import { Address } from '@ton/core';

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

    const wallet = useTonWallet();

    const loadInfo = () => {
        setLoading(true);
        apiFetch('/wallet/info', token)
            .then(async (res) => {
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json.message || 'Ошибка загрузки');
                return json as WalletInfo;
            })
            .then((data) => {
                setInfo(data);
                setUsdtAddress(data.usdtAddress ?? '');
            })
            .catch((e: any) => setError(e.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (token) loadInfo();
    }, [token]);

    // 🔗 Сохранение USDT адреса
    const handleLinkUsdt = async () => {
        setError('');
        setLinkMessage(null);
        setLinkLoading(true);

        try {
            const addr = usdtAddress.trim();
            if (!addr) throw new Error('Введите адрес USDT');

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

    // 🔗 Автосохранение TON адреса
    useEffect(() => {
        if (!wallet || !token) return;

        let raw = wallet.account.address;

        // нормализация RAW → user-friendly bounceable
        let friendly = '';
        try {
            friendly = Address.parse(raw).toString({ bounceable: true });
        } catch {
            console.error('Ошибка парсинга TON адреса');
            return;
        }

        if (info?.tonAddress === friendly) return;

        (async () => {
            try {
                const res = await apiFetch('/wallet/addresses', token, {
                    method: 'POST',
                    body: JSON.stringify({ tonAddress: friendly })
                });

                await res.json().catch(() => ({}));
                if (!res.ok) return;

                setInfo((prev) => prev ? { ...prev, tonAddress: friendly } : prev);
                setLinkMessage('TON кошелёк подключён через TonConnect!');
            } catch {}
        })();
    }, [wallet, token, info?.tonAddress]);

    // 💸 Создать заявку на вывод
    const handleWithdraw = async () => {
        if (!info) return;

        setWithdrawLoading(true);
        setWithdrawMessage(null);
        setError('');

        try {
            const coins = Number(withdrawCoins);
            if (!coins || coins <= 0) throw new Error('Некорректное число монет');

            const minCoins = Math.ceil(1 / (info.coinPriceUsd || 0.00001));
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
            setError(e.message);
        } finally {
            setWithdrawLoading(false);
        }
    };

    const minCoins = info ? Math.ceil(1 / info.coinPriceUsd) : 0;

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
                    {/* BALANCE */}
                    <div className="wallet-balance-box">
                        <div className="wallet-balance-main">
                            <span className="wallet-balance-value">{info.coins} 🪙</span>
                            <div>~ {info.usdBalance.toFixed(2)} $</div>
                        </div>
                    </div>

                    {/* TON CONNECT */}
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

                    {/* USDT WALLET */}
                    <div className="wallet-section">
                        <h3>💳 USDT кошелёк</h3>
                        <input
                            className="wallet-input"
                            value={usdtAddress}
                            onChange={(e) => setUsdtAddress(e.target.value)}
                            placeholder="TRC20 / ERC20 / BEP20 адрес"
                        />
                        <button className="menu-btn" onClick={handleLinkUsdt}>
                            {linkLoading ? 'Сохраняем...' : 'Сохранить адрес'}
                        </button>
                    </div>

                    {/* WITHDRAW */}
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

                    {/* HISTORY */}
                    <div className="wallet-section">
                        <h3>📜 История выводов</h3>
                        {info.withdrawals.length === 0 && <p>Пусто</p>}
                        {info.withdrawals.map((w) => (
                            <div key={w.id} className="wallet-history-item">
                                <span>{w.coins} → {w.amountUsd.toFixed(2)}$</span>
                                <span className={`wallet-status wallet-status--${w.status.toLowerCase()}`}>
                                    {w.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
