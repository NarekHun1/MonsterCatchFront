import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from './api';
import './Market.css';

type Currency = 'COINS' | 'STARS';

type Listing = {
    id: number;
    price: number;
    currency: Currency;
    createdAt: string;
    fromSlotIndex: number | null;
    seller: { id: number; name: string };
    monster: {
        monsterId: number;
        key: string;
        name: string;
        rarity: string;
        imgUrl: string;
        level: number;
    };
};

type FarmSlot = {
    slotIndex: number;
    isUnlocked: boolean;
    unlockPrice: number;
    fedCountToday: number;
    lastFedAt: string | null;
    monster: null | {
        userMonsterId: number;
        monsterId: number;
        key: string;
        name: string;
        rarity: string;
        imgUrl: string;
        count: number;
        level: number;
        xp: number;
        xpNext: number;
        feedCountForHunt?: number;
    };
};

type FarmResponse = {
    meat: number;
    slots: FarmSlot[];
};

type MeResponse = {
    id: number;
    username?: string | null;
    firstName?: string | null;
    stars: number;
    coins: number;
    marketUnlocked?: boolean;
};

function getErrorMessage(e: unknown, fallback = 'Ошибка') {
    if (e instanceof Error) return e.message;
    if (typeof e === 'string') return e;
    return fallback;
}

function rarityBadge(r: string) {
    const x = (r || '').toUpperCase();
    if (x === 'LEGENDARY') return 'легендарный';
    if (x === 'EPIC') return 'эпик';
    if (x === 'RARE') return 'редкий';
    return 'обычный';
}

export function Market({
                           token,
                           t,
                           onBack,
                           onMeRefresh, // optional: обновить coins/stars в хедере
                       }: {
    token: string;
    t: (k: string) => string;
    onBack: () => void;
    onMeRefresh?: () => Promise<void> | void;
}) {
    const [me, setMe] = useState<MeResponse | null>(null);

    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingFarm, setLoadingFarm] = useState(false);
    const [error, setError] = useState('');

    const [activating, setActivating] = useState(false);

    // sell modal state
    const [showSell, setShowSell] = useState(false);
    const [farm, setFarm] = useState<FarmResponse | null>(null);

    const [selectedUserMonsterId, setSelectedUserMonsterId] = useState<number | null>(null);
    const [price, setPrice] = useState<number>(100);
    const [currency, setCurrency] = useState<Currency>('COINS');
    const [selling, setSelling] = useState(false);

    const loadMe = async () => {
        const res = await apiFetch('/users/me', token);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Не удалось загрузить профиль');
        setMe(data);
    };

    const loadListings = async () => {
        const res = await apiFetch('/market/listings');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Не удалось загрузить рынок');
        setListings(Array.isArray(data) ? data : []);
    };

    const reloadAll = async () => {
        setError('');
        setLoading(true);
        try {
            await Promise.all([loadMe(), loadListings()]);
        } catch (e) {
            setError(getErrorMessage(e, 'Ошибка загрузки рынка'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!token) return;
        reloadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const canUseMarket = !!me?.marketUnlocked;

    const activateMarket = async () => {
        if (!token) return;
        setActivating(true);
        setError('');
        try {
            const res = await apiFetch('/market/activate', token, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Не удалось активировать рынок');

            // после активации — обновим профиль (coins и marketUnlocked)
            await loadMe();
            await onMeRefresh?.();
        } catch (e) {
            setError(getErrorMessage(e, 'Ошибка активации'));
        } finally {
            setActivating(false);
        }
    };

    const buy = async (listingId: number) => {
        if (!token) return;
        setError('');
        try {
            const res = await apiFetch('/market/buy', token, {
                method: 'POST',
                body: JSON.stringify({ listingId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Не удалось купить');

            // обновим ленту + профиль
            await Promise.all([loadListings(), loadMe()]);
            await onMeRefresh?.();
        } catch (e) {
            setError(getErrorMessage(e, 'Ошибка покупки'));
        }
    };

    const openSell = async () => {
        if (!token) return;
        setShowSell(true);
        setError('');

        if (farm) return; // уже грузили
        setLoadingFarm(true);
        try {
            const res = await apiFetch('/monsters/farm', token);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Не удалось загрузить ферму');

            setFarm(data);
        } catch (e) {
            setError(getErrorMessage(e, 'Ошибка загрузки фермы'));
        } finally {
            setLoadingFarm(false);
        }
    };

    const sellableFarmMonsters = useMemo(() => {
        const slots = farm?.slots ?? [];
        // берем только монстров, которые стоят в слотах и level===5
        const items: Array<{
            userMonsterId: number;
            name: string;
            rarity: string;
            imgUrl: string;
            slotIndex: number;
            level: number;
            count: number;
            key: string;
        }> = [];

        for (const s of slots) {
            const m = s.monster;
            if (!s.isUnlocked || !m) continue;
            if (m.level < 5) continue;
            items.push({
                userMonsterId: m.userMonsterId,
                name: m.name,
                rarity: m.rarity,
                imgUrl: m.imgUrl,
                slotIndex: s.slotIndex,
                level: m.level,
                count: m.count,
                key: m.key,
            });
        }

        // если один и тот же userMonsterId оказался в нескольких слотах (редко, но вдруг) — уникализируем
        const uniq = new Map<number, (typeof items)[number]>();
        for (const it of items) if (!uniq.has(it.userMonsterId)) uniq.set(it.userMonsterId, it);
        return Array.from(uniq.values()).sort((a, b) => a.slotIndex - b.slotIndex);
    }, [farm]);

    useEffect(() => {
        // дефолтный выбор в продаже
        if (!showSell) return;
        if (selectedUserMonsterId) return;
        if (sellableFarmMonsters.length > 0) {
            setSelectedUserMonsterId(sellableFarmMonsters[0].userMonsterId);
        }
    }, [showSell, sellableFarmMonsters, selectedUserMonsterId]);

    const createListing = async () => {
        if (!token) return;
        if (!selectedUserMonsterId) {
            setError('Выбери монстра');
            return;
        }
        if (!Number.isFinite(price) || price < 1) {
            setError('Цена должна быть >= 1');
            return;
        }

        setSelling(true);
        setError('');
        try {
            const res = await apiFetch('/market/list', token, {
                method: 'POST',
                body: JSON.stringify({
                    userMonsterId: selectedUserMonsterId,
                    price,
                    currency,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Не удалось выставить лот');

            // обновляем listings + ферму (слот должен освободиться)
            await Promise.all([loadListings(), loadMe()]);
            await onMeRefresh?.();

            // обновить farm заново
            const fres = await apiFetch('/monsters/farm', token);
            const fdata = await fres.json().catch(() => ({}));
            if (fres.ok) setFarm(fdata);

            setShowSell(false);
        } catch (e) {
            setError(getErrorMessage(e, 'Ошибка создания лота'));
        } finally {
            setSelling(false);
        }
    };

    if (loading) {
        return (
            <div className="market-root">
                <div className="market-top">
                    <button className="market-back" onClick={onBack}>⬅</button>
                    <div className="market-title">🧿 РЫНОК</div>
                </div>
                <div className="market-panel">
                    <div className="market-muted">{t('loading')}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="market-root">
            <div className="market-top">
                <button className="market-back" onClick={onBack}>⬅</button>
                <div className="market-title">🧿 РЫНОК МОНСТРОВ</div>

                <div className="market-balance">
                    <span className="pill">🪙 {me?.coins ?? 0}</span>
                    <span className="pill">⭐ {me?.stars ?? 0}</span>
                </div>
            </div>

            {error && <div className="market-error">{error}</div>}

            {/* UNLOCK */}
            {!canUseMarket ? (
                <div className="market-panel">
                    <div className="market-h1">Рынок закрыт</div>
                    <div className="market-muted">
                        Чтобы открыть рынок, нужно заплатить <b>200 🪙</b>.
                    </div>

                    <button
                        className="market-btn market-btn--primary"
                        onClick={activateMarket}
                        disabled={activating}
                    >
                        {activating ? 'Активируем...' : '🔓 Активировать за 200 🪙'}
                    </button>

                    <div className="market-note">
                        После активации ты сможешь продавать и покупать монстров.
                    </div>
                </div>
            ) : (
                <>
                    {/* ACTIONS */}
                    <div className="market-actions">
                        <button className="market-btn" onClick={reloadAll}>
                            🔄 Обновить
                        </button>
                        <button className="market-btn market-btn--primary" onClick={openSell}>
                            ➕ Продать монстра (Farm lvl 5)
                        </button>
                    </div>

                    {/* LISTINGS */}
                    <div className="market-panel">
                        <div className="market-h1">🔥 Лоты</div>
                        <div className="market-muted">Покупай монстров у других игроков.</div>

                        {listings.length === 0 ? (
                            <div className="market-empty">Пока нет лотов 😿</div>
                        ) : (
                            <div className="market-grid">
                                {listings.map((l) => (
                                    <div key={l.id} className="market-card">
                                        <div className="market-card-top">
                                            <div className="market-monster">
                                                <img
                                                    className="market-img"
                                                    src={l.monster.imgUrl}
                                                    alt={l.monster.name}
                                                    onError={(e) => {
                                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                                <div className="market-monster-meta">
                                                    <div className="market-monster-name">
                                                        {l.monster.name} <span className="market-lvl">lvl {l.monster.level}</span>
                                                    </div>
                                                    <div className="market-monster-sub">
                                                        {rarityBadge(l.monster.rarity)} · продавец: <b>{l.seller.name}</b>
                                                        {l.fromSlotIndex ? <span> · слот #{l.fromSlotIndex}</span> : null}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="market-price">
                                                {l.currency === 'COINS' ? '🪙' : '⭐'} {l.price}
                                            </div>
                                        </div>

                                        <div className="market-card-actions">
                                            <button
                                                className="market-btn market-btn--buy"
                                                onClick={() => buy(l.id)}
                                            >
                                                Купить
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* SELL MODAL */}
            {showSell && (
                <div className="market-modal-overlay" onClick={() => setShowSell(false)}>
                    <div className="market-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="market-modal-top">
                            <div className="market-h1">➕ Выставить на продажу</div>
                            <button className="market-x" onClick={() => setShowSell(false)}>✕</button>
                        </div>

                        {loadingFarm ? (
                            <div className="market-muted">Загружаем ферму...</div>
                        ) : sellableFarmMonsters.length === 0 ? (
                            <div className="market-empty">
                                Нет монстров 5 уровня на ферме. <br />
                                Поставь монстра в слот и докачай до lvl 5.
                            </div>
                        ) : (
                            <>
                                <div className="market-field">
                                    <div className="market-label">Монстр (только Farm lvl 5)</div>
                                    <select
                                        className="market-select"
                                        value={selectedUserMonsterId ?? ''}
                                        onChange={(e) => setSelectedUserMonsterId(Number(e.target.value))}
                                    >
                                        {sellableFarmMonsters.map((m) => (
                                            <option key={m.userMonsterId} value={m.userMonsterId}>
                                                #{m.userMonsterId} · {m.name} · {m.rarity} · slot {m.slotIndex}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="market-row">
                                    <div className="market-field">
                                        <div className="market-label">Цена</div>
                                        <input
                                            className="market-input"
                                            type="number"
                                            min={1}
                                            max={1000000}
                                            value={price}
                                            onChange={(e) => setPrice(Number(e.target.value))}
                                        />
                                    </div>

                                    <div className="market-field">
                                        <div className="market-label">Валюта</div>
                                        <select
                                            className="market-select"
                                            value={currency}
                                            onChange={(e) => setCurrency(e.target.value as Currency)}
                                        >
                                            <option value="COINS">🪙 COINS</option>
                                            <option value="STARS">⭐ STARS</option>
                                        </select>
                                    </div>
                                </div>

                                <button
                                    className="market-btn market-btn--primary"
                                    onClick={createListing}
                                    disabled={selling}
                                >
                                    {selling ? 'Выставляем...' : '✅ Выставить лот'}
                                </button>

                                <div className="market-note">
                                    После выставления слот на ферме освободится (монстр перестанет кормиться).
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
