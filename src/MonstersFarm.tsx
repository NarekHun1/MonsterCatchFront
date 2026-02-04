// src/MonstersFarm.tsx  (или src/screens/MonstersFarm.tsx — поправь импорты)
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from './api';
import type { FarmSlot } from './types/monsters';
import './MonstersFarm.css';

interface Props {
    token: string;
    onBack?: () => void;
}

export default function MonstersFarm({ token, onBack }: Props) {
    const [slots, setSlots] = useState<FarmSlot[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const railRef = useRef<HTMLDivElement | null>(null);

    const tg = (window as any).Telegram?.WebApp;
    const haptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
        try {
            tg?.HapticFeedback?.impactOccurred?.(type);
        } catch {}
    };

    const hasSlots = slots.length > 0;

    const activeSlot: FarmSlot | null = useMemo(() => {
        if (!hasSlots) return null;
        const idx = Math.max(0, Math.min(activeIndex, slots.length - 1));
        return slots[idx] ?? null;
    }, [slots, activeIndex, hasSlots]);

    async function loadFarm(keepIndex = true) {
        try {
            setLoading(true);
            const res = await apiFetch('/monsters/farm', token);
            const data = await res.json().catch(() => ({}));

            if (!res.ok) throw new Error(data.message || 'Failed to load farm');

            const nextSlots: FarmSlot[] = data.slots ?? [];
            setSlots(nextSlots);

            setError(null);

            if (!keepIndex) setActiveIndex(0);
            else {
                setActiveIndex((prev) => Math.max(0, Math.min(prev, nextSlots.length - 1)));
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to load farm');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadFarm(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ===== Scroll → determine active index (snap)
    const onRailScroll = () => {
        const rail = railRef.current;
        if (!rail) return;

        const children = Array.from(rail.children) as HTMLElement[];
        if (children.length === 0) return;

        const railRect = rail.getBoundingClientRect();
        const railCenter = railRect.left + railRect.width / 2;

        let bestIdx = 0;
        let bestDist = Infinity;

        for (let i = 0; i < children.length; i++) {
            const r = children[i].getBoundingClientRect();
            const c = r.left + r.width / 2;
            const d = Math.abs(c - railCenter);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }

        setActiveIndex(bestIdx);
    };

    // ===== Scroll to specific slot
    const goToIndex = (idx: number) => {
        const rail = railRef.current;
        if (!rail) return;

        const clamped = Math.max(0, Math.min(idx, slots.length - 1));
        const el = rail.children.item(clamped) as HTMLElement | null;
        if (!el) return;

        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        setActiveIndex(clamped);
        haptic('light');
    };

    // ===== Actions
    async function feedActive() {
        if (!activeSlot) return;
        if (!activeSlot.isUnlocked) return;
        if (!activeSlot.monster) return;
        if (activeSlot.fedCountToday >= 5) {
            tg?.showAlert?.('Лимит кормления: 5/5 на сегодня');
            return;
        }

        try {
            setBusy(true);
            haptic('medium');

            const res = await apiFetch('/monsters/farm/feed', token, {
                method: 'POST',
                body: JSON.stringify({ slotIndex: activeSlot.slotIndex }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Feed failed');

            // Обновляем ферму и остаёмся на этом же индексе
            await loadFarm(true);
        } catch (e: any) {
            tg?.showAlert?.(e?.message || 'Feed failed');
        } finally {
            setBusy(false);
        }
    }

    async function unlockActive() {
        if (!activeSlot) return;
        if (activeSlot.isUnlocked) return;

        try {
            setBusy(true);
            haptic('medium');

            const res = await apiFetch('/monsters/farm/unlock', token, {
                method: 'POST',
                body: JSON.stringify({ slotIndex: activeSlot.slotIndex }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Unlock failed');

            await loadFarm(true);
        } catch (e: any) {
            tg?.showAlert?.(e?.message || 'Unlock failed');
        } finally {
            setBusy(false);
        }
    }

    // ===== UI helpers
    const activeMonster = activeSlot?.monster ?? null;
    const canFeed =
        !!activeSlot?.isUnlocked &&
        !!activeMonster &&
        (activeSlot?.fedCountToday ?? 0) < 5 &&
        !busy;

    const canUnlock = !!activeSlot && !activeSlot.isUnlocked && !busy;

    if (loading) {
        return (
            <div className="monsters-farm">
                <div className="farm-top">
                    {onBack ? (
                        <button className="farm-back" onClick={onBack}>
                            ⬅
                        </button>
                    ) : (
                        <div />
                    )}
                    <div className="farm-title">🐲 Monsters</div>
                    <button className="farm-refresh" onClick={() => loadFarm(true)}>
                        ⟳
                    </button>
                </div>

                <div className="farm-loading">Loading…</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="monsters-farm">
                <div className="farm-top">
                    {onBack ? (
                        <button className="farm-back" onClick={onBack}>
                            ⬅
                        </button>
                    ) : (
                        <div />
                    )}
                    <div className="farm-title">🐲 Monsters</div>
                    <button className="farm-refresh" onClick={() => loadFarm(true)}>
                        ⟳
                    </button>
                </div>

                <div className="farm-error">
                    <div className="farm-error-title">Ошибка</div>
                    <div className="farm-error-text">{error}</div>
                    <button className="farm-primary" onClick={() => loadFarm(true)}>
                        🔄 Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!hasSlots) {
        return (
            <div className="monsters-farm">
                <div className="farm-top">
                    {onBack ? (
                        <button className="farm-back" onClick={onBack}>
                            ⬅
                        </button>
                    ) : (
                        <div />
                    )}
                    <div className="farm-title">🐲 Monsters</div>
                    <button className="farm-refresh" onClick={() => loadFarm(true)}>
                        ⟳
                    </button>
                </div>

                <div className="farm-empty">
                    <div className="farm-empty-emoji">🐣</div>
                    <div className="farm-empty-text">Нет слотов. Проверь backend /monsters/farm</div>
                </div>
            </div>
        );
    }

    return (
        <div className="monsters-farm">
            <div className="farm-top">
                {onBack ? (
                    <button className="farm-back" onClick={onBack}>
                        ⬅
                    </button>
                ) : (
                    <div />
                )}
                <div className="farm-title">🐲 Monsters</div>
                <button className="farm-refresh" onClick={() => loadFarm(true)}>
                    ⟳
                </button>
            </div>

            {/* ===== Carousel ===== */}
            <div className="farm-rail" ref={railRef} onScroll={onRailScroll}>
                {slots.map((slot, idx) => (
                    <Slide key={slot.slotIndex} slot={slot} isActive={idx === activeIndex} />
                ))}
            </div>

            {/* ===== Dots ===== */}
            <div className="farm-dots">
                {slots.map((s, i) => {
                    const cls =
                        i === activeIndex
                            ? 'dot dot--active'
                            : s.isUnlocked
                                ? 'dot'
                                : 'dot dot--locked';

                    return (
                        <button
                            key={s.slotIndex}
                            className={cls}
                            onClick={() => goToIndex(i)}
                            aria-label={`slot ${s.slotIndex}`}
                        />
                    );
                })}
            </div>

            {/* ===== Bottom action bar (like in your screenshot) ===== */}
            <div className="farm-bottom">
                <div className="farm-bottom-left">
                    <div className="farm-bottom-name">
                        {activeSlot?.isUnlocked
                            ? activeMonster
                                ? activeMonster.name
                                : `Slot #${activeSlot.slotIndex} (Empty)`
                            : `Slot #${activeSlot?.slotIndex} (Locked)`}
                    </div>

                    {activeSlot?.isUnlocked && activeMonster ? (
                        <div className="farm-bottom-sub">
                            LVL {activeMonster.level} · Fed {activeSlot.fedCountToday}/5
                        </div>
                    ) : (
                        <div className="farm-bottom-sub">Swipe left / right</div>
                    )}
                </div>

                {activeSlot && !activeSlot.isUnlocked ? (
                    <button className="farm-primary" disabled={!canUnlock} onClick={unlockActive}>
                        🔓 Unlock · {activeSlot.unlockPrice} 🪙
                    </button>
                ) : (
                    <button className="farm-primary" disabled={!canFeed} onClick={feedActive}>
                        🍖 Кормить
                    </button>
                )}
            </div>
        </div>
    );
}

function Slide({ slot, isActive }: { slot: FarmSlot; isActive: boolean }) {
    const m = slot.monster;

    const rarityClass = m ? `rarity-${m.rarity.toLowerCase()}` : '';
    const xpPct = m?.xpNext ? Math.max(0, Math.min(100, (m.xp / m.xpNext) * 100)) : 0;

    return (
        <div className={`farm-slide ${isActive ? 'farm-slide--active' : ''}`}>
            <div className={`farm-card ${slot.isUnlocked ? '' : 'farm-card--locked'}`}>
                <div className="farm-card-top">
                    <div className="farm-chip">#{slot.slotIndex}</div>
                    {m ? <div className={`farm-chip farm-chip--rarity ${rarityClass}`}>{m.rarity}</div> : <div />}
                </div>

                {!slot.isUnlocked ? (
                    <div className="farm-locked">
                        <div className="farm-locked-emoji">🔒</div>
                        <div className="farm-locked-title">Locked</div>
                        <div className="farm-locked-sub">Unlock price: {slot.unlockPrice} 🪙</div>
                    </div>
                ) : !m ? (
                    <div className="farm-empty-card">
                        <div className="farm-empty-emoji">➕</div>
                        <div className="farm-empty-title">Empty slot</div>
                        <div className="farm-empty-sub">Assign monster (next step)</div>
                    </div>
                ) : (
                    <>
                        <img className="farm-monster-img" src={m.imgUrl} alt={m.name} />
                        <div className={`farm-monster-name ${rarityClass}`}>{m.name}</div>
                        <div className="farm-monster-level">LVL {m.level}</div>

                        {m.xpNext ? (
                            <>
                                <div className="farm-xpbar">
                                    <div className="farm-xpfill" style={{ width: `${xpPct}%` }} />
                                </div>
                                <div className="farm-xptext">
                                    XP {m.xp} / {m.xpNext}
                                </div>
                            </>
                        ) : (
                            <div className="farm-xpmax">MAX LEVEL</div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
