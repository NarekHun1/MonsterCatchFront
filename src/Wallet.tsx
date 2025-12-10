// src/Wallet.tsx
import { useEffect, useState } from "react";
import { TonConnectButton, useTonWallet } from "@tonconnect/ui-react";
import { Address } from "@ton/core";
import { apiFetch } from "./api";

type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";
type WithdrawalCurrency = "USDT" | "TON";

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
    const wallet = useTonWallet();

    const [info, setInfo] = useState<WalletInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [usdtAddress, setUsdtAddress] = useState("");
    const [linkLoading, setLinkLoading] = useState(false);
    const [linkMessage, setLinkMessage] = useState<string | null>(null);

    const [withdrawCurrency, setWithdrawCurrency] =
        useState<WithdrawalCurrency>("USDT");
    const [withdrawCoins, setWithdrawCoins] = useState("");
    const [withdrawLoading, setWithdrawLoading] = useState(false);
    const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);

    // ------------------ LOAD INFO ------------------
    const loadInfo = () => {
        setLoading(true);
        setError("");

        apiFetch("/wallet/info", token)
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.message || "Ошибка загрузки кошелька");
                return data as WalletInfo;
            })
            .then((data) => {
                setInfo(data);
                setUsdtAddress(data.usdtAddress ?? "");
            })
            .catch((e) => {
                console.error(e);
                setError(e.message || "Ошибка");
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (token) loadInfo();
    }, [token]);

    // ------------------ SAVE USDT ADDRESS ------------------
    const handleLinkUsdt = async () => {
        setLinkLoading(true);
        setError("");
        try {
            const adr = usdtAddress.trim();
            if (!adr) throw new Error("Введи адрес USDT");

            const res = await apiFetch("/wallet/addresses", token, {
                method: "POST",
                body: JSON.stringify({ usdtAddress: adr }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Не удалось сохранить");

            setLinkMessage("USDT-адрес успешно сохранён!");
            if (info) setInfo({ ...info, usdtAddress: adr });
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLinkLoading(false);
        }
    };

    // ------------------ AUTO-SAVE TON ADDRESS ------------------
    useEffect(() => {
        if (!wallet || !wallet.account || !wallet.account.address) return;

        let friendly = "";
        try {
            friendly = Address.parse(wallet.account.address).toString({
                bounceable: false,
                urlSafe: true,
            });
        } catch (e) {
            console.error("Address parse error:", e);
            return;
        }

        if (info?.tonAddress === friendly) return; // already saved

        (async () => {
            try {
                const res = await apiFetch("/wallet/addresses", token, {
                    method: "POST",
                    body: JSON.stringify({ tonAddress: friendly }),
                });

                await res.json().catch(() => ({}));
                if (!res.ok) return;

                setInfo((prev) => (prev ? { ...prev, tonAddress: friendly } : prev));
                setLinkMessage("TON-кошелёк подключён!");
            } catch (e) {
                console.error(e);
            }
        })();
    }, [wallet, token, info?.tonAddress]);

    // ------------------ WITHDRAW ------------------
    const handleWithdraw = async () => {
        if (!info) return;

        setWithdrawLoading(true);
        setError("");
        setWithdrawMessage(null);

        try {
            const coins = Number(withdrawCoins);
            if (!coins || coins <= 0) throw new Error("Некорректное число монет");

            const minUsd = 1;
            const price = info.coinPriceUsd || 0.0001;
            const minCoins = Math.ceil(minUsd / price);

            if (coins < minCoins)
                throw new Error(`Минимум к выводу: ${minCoins} монет`);

            const res = await apiFetch("/wallet/withdraw", token, {
                method: "POST",
                body: JSON.stringify({
                    coins,
                    currency: withdrawCurrency,
                    network: withdrawCurrency === "USDT" ? "TRC20" : "TON",
                    addressType: "SAVED",
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Ошибка вывода");

            setWithdrawMessage(`Заявка создана! ID: ${data.id}`);
            setWithdrawCoins("");
            loadInfo();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setWithdrawLoading(false);
        }
    };

    // ------------------ RENDER ------------------
    return (
        <div className="panel">
            <button className="back-btn" onClick={onBack}>⬅ Назад</button>

            <h2>👛 Кошелёк</h2>

            {loading && <p>Загрузка...</p>}
            {error && <p className="panel-error">{error}</p>}
            {linkMessage && <p className="panel-success">{linkMessage}</p>}
            {withdrawMessage && <p className="panel-success">{withdrawMessage}</p>}

            {!info ? null : (
                <>
                    {/* BALANCE */}
                    <div className="wallet-balance-box">
                        <div className="wallet-balance-main">
                            <span>Баланс: {info.coins} 🪙</span>
                            <div>~ {info.usdBalance.toFixed(2)} $</div>
                        </div>
                    </div>

                    {/* TON CONNECT */}
                    <div className="wallet-section">
                        <h3>🔗 TON Connect</h3>
                        <TonConnectButton />

                        {wallet && (
                            <p>
                                Подключен: {wallet.account.address.slice(0, 6)}...
                                {wallet.account.address.slice(-4)}
                            </p>
                        )}
                    </div>

                    {/* USDT */}
                    <div className="wallet-section">
                        <h3>💳 USDT-кошелёк</h3>
                        <input
                            className="wallet-input"
                            value={usdtAddress}
                            onChange={(e) => setUsdtAddress(e.target.value)}
                        />
                        <button onClick={handleLinkUsdt} disabled={linkLoading}>
                            {linkLoading ? "Сохранение..." : "Сохранить"}
                        </button>
                    </div>

                    {/* WITHDRAW */}
                    <div className="wallet-section">
                        <h3>💸 Вывод</h3>

                        <input
                            type="number"
                            className="wallet-input"
                            value={withdrawCoins}
                            onChange={(e) => setWithdrawCoins(e.target.value)}
                        />

                        <div className="wallet-tabs">
                            <button
                                className={withdrawCurrency === "USDT" ? "active" : ""}
                                onClick={() => setWithdrawCurrency("USDT")}
                            >
                                USDT
                            </button>

                            <button
                                className={withdrawCurrency === "TON" ? "active" : ""}
                                onClick={() => setWithdrawCurrency("TON")}
                            >
                                TON
                            </button>
                        </div>

                        <button onClick={handleWithdraw} disabled={withdrawLoading}>
                            {withdrawLoading ? "Отправляем..." : "Создать заявку"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
