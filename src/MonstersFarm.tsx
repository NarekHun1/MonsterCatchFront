// src/screens/MonstersFarm.tsx
import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import type { FarmSlot } from './types/monsters';
import './MonstersFarm.css';

interface Props {
    token: string;
}

export default function MonstersFarm({ token }: Props) {
    const [slots, setSlots] = useState<FarmSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    async function loadFarm() {
        try {
            setLoading(true);
            const res = await apiFetch('/monsters/farm', token);
            const data = await res.json();
            setSlots(data.slots || []);
            setError(null);
        } catch (e: any) {
            setError(e?.message || 'Failed to load farm');
        } finally {
            setLoading(false);
        }
    }

    async function feed(slotIndex: number) {
        try {
            const res = await apiFetch('/monsters/farm/feed', token, {
                method: 'POST',
                body: JSON.stringify({ slotIndex }),
            });

            // backend возвращает json; если пусто — не падаем
            try {
                await res.json();
            } catch {}

            await loadFarm();
        } catch (e: any) {
            (window as any).Telegram?.WebApp?.showAlert?.(
                e?.message || 'Feed failed',
            );
        }
    }

    async function unlock(slotIndex: number) {
        try {
            const res = await apiFetch('/monsters/farm/unlock', token, {
                method: 'POST',
                body: JSON.stringify({ slotIndex }),
            });

            try {
                await res.json();
            } catch {}

            await loadFarm();
        } catch (e: any) {
            (window as any).Telegram?.WebApp?.showAlert?.(
                e?.message || 'Unlock failed',
            );
        }
    }

    useEffect(() => {
        loadFarm();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) {
        return (
            <div className="monsters-farm">
                <h2>🐲 Monsters Farm</h2>
                <div className="farm-grid">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="slot-card slot-skeleton" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="monsters-farm">
                <h2>🐲 Monsters Farm</h2>
                <div className="error-box">
                    <div className="error-title">Ошибка</div>
                    <div className="error-text">{error}</div>
                    <button className="btn btn-feed" onClick={loadFarm}>
                        🔄 Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="monsters-farm">
            <div className="farm-header">
                <h2>🐲 Monsters Farm</h2>
                <button className="btn btn-ghost" onClick={loadFarm}>
                    ⟳
                </button>
            </div>

            <div className="farm-grid">
                {slots.map((slot) => (
                    <SlotCard
                        key={slot.slotIndex}
                        slot={slot}
                        onFeed={() => feed(slot.slotIndex)}
                        onUnlock={() => unlock(slot.slotIndex)}
                    />
                ))}
            </div>

            <div className="farm-hint">
                Tap slot → feed your monster. Daily limit: <b>5 feeds</b>.
            </div>
        </div>
    );
}

function SlotCard({
                      slot,
                      onFeed,
                      onUnlock,
                  }: {
    slot: FarmSlot;
    onFeed: () => void;
    onUnlock: () => void;
}) {
    // LOCKED
    if (!slot.isUnlocked) {
        return (
            <div className="slot-card slot-locked">
                <div className="slot-top">
                    <div className="slot-badge">#{slot.slotIndex}</div>
                </div>

                <div className="lock">🔒</div>
                <div className="slot-title">Locked slot</div>
                <div className="unlock-price">Unlock: {slot.unlockPrice} 🪙</div>

                <button className="btn btn-unlock" onClick={onUnlock}>
                    🔓 Unlock
                </button>
            </div>
        );
    }

    // UNLOCKED BUT EMPTY
    if (!slot.monster) {
        return (
            <div className="slot-card slot-empty-card">
                <div className="slot-top">
                    <div className="slot-badge">#{slot.slotIndex}</div>
                </div>

                <div className="slot-empty">Empty</div>
                <div className="slot-empty-sub">
                    Assign a monster from your collection
                </div>

                <button className="btn btn-disabled" disabled>
                    ➕ Coming soon
                </button>
            </div>
        );
    }

    // WITH MONSTER
    const m = slot.monster;
    const rarityClass =
        m.rarity === 'COMMON'
            ? 'monster-common'
            : m.rarity === 'RARE'
                ? 'monster-rare'
                : m.rarity === 'EPIC'
                    ? 'monster-epic'
                    : 'monster-legendary';

    const xpPct =
        m.xpNext && m.xpNext > 0 ? Math.max(0, Math.min(100, (m.xp / m.xpNext) * 100)) : 100;

    const feedDisabled = slot.fedCountToday >= 5;

    return (
        <div className="slot-card">
            <div className="slot-top">
                <div className="slot-badge">#{slot.slotIndex}</div>
                <div className={`rarity-pill ${rarityClass}`}>{m.rarity}</div>
            </div>

            <img className="monster-img" src={m.imgUrl} alt={m.name} />

            <div className={`monster-name ${rarityClass}`}>{m.name}</div>

            <div className="monster-level">Lvl {m.level}</div>

            {m.xpNext ? (
                <>
                    <div className="xp-bar" aria-label="XP progress">
                        <div className="xp-fill" style={{ width: `${xpPct}%` }} />
                    </div>
                    <div className="xp-text">
                        XP: {m.xp} / {m.xpNext}
                    </div>
                </>
            ) : (
                <div className="xp-max">MAX LEVEL</div>
            )}

            <div className="feed-info">
                Fed today: <b>{slot.fedCountToday}</b>/5
            </div>

            <button
                className={`btn ${feedDisabled ? 'btn-disabled' : 'btn-feed'}`}
                onClick={onFeed}
                disabled={feedDisabled}
            >
                🍖 Feed
            </button>
        </div>
    );
}
