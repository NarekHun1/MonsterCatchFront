// src/MonstersFarm.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from './api';
import type { FarmSlot } from './types/monsters';
import './MonstersFarm.css';

// ✅ local fallback images
import commonImg from './assets/monsters/common.svg';
import rareImg from './assets/monsters/rare.svg';
import epicImg from './assets/monsters/epic.svg';
import legendaryImg from './assets/monsters/legendary.svg';

interface Props {
    token: string;
    onBack?: () => void;
}

type CollectionMonster = {
    userMonsterId: number;
    monsterId: number;
    key: string;
    name: string;
    rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | string;
    imgUrl: string;
    count: number;
    level: number;
    xp: number;
    xpNext: number | null;
};

function fallbackByRarity(rarity?: string) {
    switch (rarity) {
        case 'LEGENDARY':
            return legendaryImg;
        case 'EPIC':
            return epicImg;
        case 'RARE':
            return rareImg;
        default:
            return commonImg;
    }
}

export default function MonstersFarm({ token, onBack }: Props) {
    const [slots, setSlots] = useState<FarmSlot[]>([]);
    const [meat, setMeat] = useState<number>(0);

    const [activeIndex, setActiveIndex] = useState(0);

    // ❌ НЕ показываем full-screen loading вообще
    const [initialLoaded, setInitialLoaded] = useState(false);

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ✅ collection picker
    const [showPicker, setShowPicker] = useState(false);
    const [collection, setCollection] = useState<CollectionMonster[]>([]);
    const [pickerSlotIndex, setPickerSlotIndex] = useState<number | null>(null);

    // ✅ tap flash trigger
    const [tapFx, setTapFx] = useState(0);

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
            const res = await apiFetch('/monsters/farm', token);
            const data = await res.json().catch(() => ({}));

            if (!res.ok) throw new Error(data.message || 'Failed to load farm');

            const nextSlots: FarmSlot[] = data.slots ?? [];
            setSlots(nextSlots);
            setMeat(Number(data.meat ?? 0));
            setError(null);

            if (!keepIndex) setActiveIndex(0);
            else setActiveIndex((prev) => Math.max(0, Math.min(prev, nextSlots.length - 1)));

            setInitialLoaded(true);
        } catch (e: any) {
            setError(e?.message || 'Failed to load farm');
            setInitialLoaded(true);
        }
    }

    async function loadCollection() {
        const res = await apiFetch('/monsters/collection', token);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Failed to load collection');
        setCollection((data.monsters ?? []) as CollectionMonster[]);
    }

    async function openPicker(slotIndex: number) {
        try {
            setBusy(true);
            setPickerSlotIndex(slotIndex);
            await loadCollection();
            setShowPicker(true);
        } catch (e: any) {
            tg?.showAlert?.(e?.message || 'Failed to load collection');
        } finally {
            setBusy(false);
        }
    }

    async function assignMonster(slotIndex: number, userMonsterId: number) {
        try {
            setBusy(true);

            const res = await apiFetch('/monsters/farm/assign', token, {
                method: 'POST',
                body: JSON.stringify({ slotIndex, userMonsterId }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Assign failed');

            setShowPicker(false);
            setPickerSlotIndex(null);

            // ✅ тихо обновим слот/мясо (без Loading)
            await loadFarm(true);

            haptic('light');
        } catch (e: any) {
            tg?.showAlert?.(e?.message || 'Assign failed');
        } finally {
            setBusy(false);
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

    // ✅ feed by slot index (UNLIMITED)
    async function feedSlot(slotIndex: number) {
        try {
            if (busy) return;

            setBusy(true);
            haptic('medium');

            // ✅ эффект вместо Loading
            setTapFx(Date.now());

            const res = await apiFetch('/monsters/farm/feed', token, {
                method: 'POST',
                body: JSON.stringify({ slotIndex }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Feed failed');

            if (typeof data.meatLeft === 'number') setMeat(data.meatLeft);

            // ✅ без full-screen loading
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

    const activeMonster = activeSlot?.monster ?? null;
    const canUnlock = !!activeSlot && !activeSlot.isUnlocked && !busy;

    const canFeedActive = !!activeSlot?.isUnlocked && !!activeMonster && meat >= 1 && !busy;

    // ✅ вместо Loading… показываем просто пустой фон/скелет (но НЕ текст Loading)
    if (!initialLoaded) {
        return (
            <div className="monsters-farm">
                <div className="farm-top">
                    {onBack ? (
                        <button type="button" className="farm-back" onClick={onBack}>
                            ⬅
                        </button>
                    ) : (
                        <div />
                    )}
                    <div className="farm-title">🐲 Monsters</div>
                    <button type="button" className="farm-refresh" onClick={() => loadFarm(true)}>
                        ⟳
                    </button>
                </div>

                {/* пустой экран без Loading */}
                <div style={{ height: 220 }} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="monsters-farm">
                <div className="farm-top">
                    {onBack ? (
                        <button type="button" className="farm-back" onClick={onBack}>
                            ⬅
                        </button>
                    ) : (
                        <div />
                    )}
                    <div className="farm-title">🐲 Monsters</div>
                    <button type="button" className="farm-refresh" onClick={() => loadFarm(true)}>
                        ⟳
                    </button>
                </div>

                <div className="farm-error">
                    <div className="farm-error-title">Ошибка</div>
                    <div className="farm-error-text">{error}</div>
                    <button type="button" className="farm-primary" onClick={() => loadFarm(true)}>
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
                        <button type="button" className="farm-back" onClick={onBack}>
                            ⬅
                        </button>
                    ) : (
                        <div />
                    )}
                    <div className="farm-title">🐲 Monsters</div>
                    <button type="button" className="farm-refresh" onClick={() => loadFarm(true)}>
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
                    <button type="button" className="farm-back" onClick={onBack}>
                        ⬅
                    </button>
                ) : (
                    <div />
                )}

                <div className="farm-title">🐲 Monsters</div>

                <button type="button" className="farm-refresh" onClick={() => loadFarm(true)}>
                    ⟳
                </button>
            </div>

            {/* ===== Carousel ===== */}
            <div className="farm-rail" ref={railRef} onScroll={onRailScroll}>
                {slots.map((slot, idx) => (
                    <Slide
                        key={slot.slotIndex}
                        slot={slot}
                        isActive={idx === activeIndex}
                        busy={busy}
                        meat={meat}
                        tapFx={tapFx}
                        onAssign={() => {
                            setActiveIndex(idx);
                            openPicker(slot.slotIndex);
                        }}
                        onClick={() => {
                            setActiveIndex(idx);

                            if (!slot.isUnlocked) return;
                            if (!slot.monster) return;

                            if (meat < 1) {
                                tg?.showAlert?.('Нет мяса 🍖');
                                return;
                            }
                            if (busy) return;

                            feedSlot(slot.slotIndex);
                        }}
                    />
                ))}
            </div>

            {/* ===== Dots ===== */}
            <div className="farm-dots">
                {slots.map((s, i) => {
                    const cls =
                        i === activeIndex ? 'dot dot--active' : s.isUnlocked ? 'dot' : 'dot dot--locked';
                    return (
                        <button
                            type="button"
                            key={s.slotIndex}
                            className={cls}
                            onClick={() => goToIndex(i)}
                            aria-label={`slot ${s.slotIndex}`}
                        />
                    );
                })}
            </div>

            {/* ===== Bottom bar ===== */}
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
                        <div className="farm-bottom-sub">👆 Нажми на монстра чтобы кормить (-1 🍖)</div>
                    ) : (
                        <div className="farm-bottom-sub">Swipe left / right</div>
                    )}
                </div>

                {activeSlot && !activeSlot.isUnlocked ? (
                    <button type="button" className="farm-primary" disabled={!canUnlock} onClick={unlockActive}>
                        🔓 Unlock · {activeSlot.unlockPrice} 🪙
                    </button>
                ) : activeSlot?.isUnlocked && !activeSlot?.monster ? (
                    <button
                        type="button"
                        className="farm-primary"
                        disabled={busy || !activeSlot?.isUnlocked}
                        onClick={() => activeSlot && openPicker(activeSlot.slotIndex)}
                    >
                        ➕ Assign
                    </button>
                ) : (
                    <div className="farm-hint">
                        {activeSlot?.monster
                            ? canFeedActive
                                ? '👆 Нажми на монстра чтобы кормить (-1 🍖)'
                                : meat < 1
                                    ? 'Нет мяса 🍖'
                                    : 'Нажми на монстра'
                            : 'Назначение монстра — следующий шаг'}
                    </div>
                )}
            </div>

            {/* ✅ Picker modal */}
            <MonsterPicker
                open={showPicker}
                busy={busy}
                monsters={collection}
                onClose={() => setShowPicker(false)}
                onPick={(userMonsterId) => {
                    if (pickerSlotIndex == null) {
                        tg?.showAlert?.('Slot is not selected');
                        return;
                    }
                    assignMonster(pickerSlotIndex, userMonsterId);
                }}
            />
        </div>
    );
}

function Slide({
                   slot,
                   isActive,
                   onClick,
                   onAssign,
                   busy,
                   meat,
                   tapFx,
               }: {
    slot: FarmSlot;
    isActive: boolean;
    onClick: () => void;
    onAssign: () => void;
    busy: boolean;
    meat: number;
    tapFx: number;
}) {
    const m = slot.monster;

    const rarityClass = m ? `rarity-${String(m.rarity).toLowerCase()}` : '';
    const xpNext = m?.xpNext ?? 0;
    const xpPct = xpNext > 0 ? Math.max(0, Math.min(100, (m!.xp / xpNext) * 100)) : 0;

    const isFeedable = !!slot.isUnlocked && !!m && meat >= 1 && !busy;

    return (
        <div className={`farm-slide ${isActive ? 'farm-slide--active' : ''}`}>
            <button
                type="button"
                className={`farm-card ${slot.isUnlocked ? '' : 'farm-card--locked'} ${
                    isFeedable ? 'farm-card--tap' : ''
                }`}
                onClick={onClick}
            >
                {/* ✅ tap flash effect (only on active card) */}
                {isActive && <div key={tapFx} className="farm-tap-flash" />}

                <div className="farm-card-top">
                    <div className="farm-chip">#{slot.slotIndex}</div>
                    {m ? <div className={`farm-chip farm-chip--rarity ${rarityClass}`}>{m.rarity}</div> : <div />}
                </div>

                {isActive && (
                    <div className="farm-meat-badge" title="Meat">
                        🍖 {meat}
                    </div>
                )}

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
                        <div className="farm-empty-sub">Choose a monster from collection</div>

                        {/* ✅ НЕ button (чтобы не было button внутри button) */}
                        <div
                            className="farm-assign-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAssign();
                            }}
                            role="button"
                            tabIndex={0}
                        >
                            ➕ Assign monster
                        </div>
                    </div>
                ) : (
                    <>
                        <img
                            className="farm-monster-img"
                            src={m.imgUrl || fallbackByRarity(m.rarity)}
                            alt={m.name}
                            onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = fallbackByRarity(m.rarity);
                            }}
                        />

                        <div className={`farm-monster-name ${rarityClass}`}>{m.name}</div>
                        <div className="farm-monster-level">LVL {m.level}</div>

                        <div className="farm-xpbar">
                            <div className="farm-xpfill" style={{ width: `${xpPct}%` }} />
                        </div>
                        <div className="farm-xptext">XP {m.xp} / {m.xpNext ?? '—'}</div>

                        <div className="farm-tap-hint">
                            {busy ? '…' : isFeedable ? '👆 Tap to feed (-1 🍖)' : meat < 1 ? 'Нет мяса 🍖' : '👆 Tap'}
                        </div>
                    </>
                )}
            </button>
        </div>
    );
}

function MonsterPicker({
                           open,
                           busy,
                           monsters,
                           onClose,
                           onPick,
                       }: {
    open: boolean;
    busy: boolean;
    monsters: CollectionMonster[];
    onClose: () => void;
    onPick: (userMonsterId: number) => void;
}) {
    if (!open) return null;

    return (
        <div className="picker-overlay" onClick={onClose}>
            <div className="picker-card" onClick={(e) => e.stopPropagation()}>
                <div className="picker-top">
                    <div className="picker-title">🐲 My Monsters</div>
                    <button type="button" className="picker-close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="picker-list">
                    {monsters.length === 0 ? (
                        <div className="picker-empty">
                            <div className="picker-empty-emoji">🫥</div>
                            <div className="picker-empty-title">No monsters yet</div>
                            <div className="picker-empty-sub">Play the game and catch some monsters first.</div>
                        </div>
                    ) : (
                        monsters.map((m) => (
                            <button
                                type="button"
                                key={m.userMonsterId}
                                className="picker-item"
                                disabled={busy || (m.count ?? 0) <= 0}
                                onClick={() => onPick(m.userMonsterId)}
                            >
                                <img
                                    className="picker-img"
                                    src={m.imgUrl || fallbackByRarity(m.rarity)}
                                    alt={m.name}
                                    onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).src = fallbackByRarity(m.rarity);
                                    }}
                                />
                                <div className="picker-mid">
                                    <div className="picker-name">{m.name}</div>
                                    <div className="picker-sub">
                                        LVL {m.level} · x{m.count} · {m.rarity}
                                    </div>
                                </div>
                                <div className="picker-cta">{busy ? '…' : 'Select'}</div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
