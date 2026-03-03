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
    feedCountForHunt?: number; // ✅ used after level 5
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
    type HuntStatusUI = 'IDLE' | 'RUNNING' | 'READY';
    type HuntInfo = {
        status: HuntStatusUI;
        endsAt: string | null;
        secondsLeft: number;
        feedCountForHunt: number;
        canStart: boolean;
        canClaim: boolean;
    };

    const tg = (window as any).Telegram?.WebApp;
    const haptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
        try {
            tg?.HapticFeedback?.impactOccurred?.(type);
        } catch {}
    };

    const railRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);

    // ✅ fast-feed refs (Hamster style)
    const feedLockRef = useRef(false); // prevents parallel requests
    const lastFeedAtRef = useRef(0); // tap throttle
    const refreshTimerRef = useRef<number | null>(null); // debounce refresh

    const [hunt, setHunt] = useState<HuntInfo | null>(null);
    const [slots, setSlots] = useState<FarmSlot[]>([]);
    const [meat, setMeat] = useState<number>(0);

    const [activeIndex, setActiveIndex] = useState(0);

    // no full-screen loading label; show skeleton
    const [initialLoaded, setInitialLoaded] = useState(false);

    const [busy, setBusy] = useState(false); // keep for unlock/assign/hunt actions
    const [error, setError] = useState<string | null>(null);

    // picker
    const [showPicker, setShowPicker] = useState(false);
    const [collection, setCollection] = useState<CollectionMonster[]>([]);
    const [pickerSlotIndex, setPickerSlotIndex] = useState<number | null>(null);

    // tap flash trigger
    const [tapFx, setTapFx] = useState(0);

    const hasSlots = slots.length > 0;

    const activeSlot: FarmSlot | null = useMemo(() => {
        if (!hasSlots) return null;
        const idx = Math.max(0, Math.min(activeIndex, slots.length - 1));
        return slots[idx] ?? null;
    }, [slots, activeIndex, hasSlots]);

    const activeMonster = activeSlot?.monster ?? null;

    const activeMonsterId = useMemo(() => {
        const id = (activeMonster as any)?.userMonsterId;
        return typeof id === 'number' ? id : null;
    }, [activeMonster]);

    const canUnlock = !!activeSlot && !activeSlot.isUnlocked && !busy;

    const huntBlocksFeed = hunt?.status === 'RUNNING' && (hunt?.secondsLeft ?? 0) > 0;

    // NOTE: we intentionally DON'T use "busy" here for feeding
    const canFeedActive =
        !!activeSlot?.isUnlocked && !!activeMonster && meat >= 1 && !huntBlocksFeed;

    const showHuntPanel =
        !!activeSlot?.isUnlocked &&
        !!activeMonster &&
        activeMonster.level >= 5 &&
        (hunt?.status === 'RUNNING' || hunt?.status === 'READY' || !!hunt?.canStart);

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

    async function loadHuntStatus(userMonsterId: number) {
        const res = await apiFetch(`/monsters/hunt/status?userMonsterId=${userMonsterId}`, token);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Failed to load hunt status');

        setHunt({
            status: data.status,
            endsAt: data.endsAt ? String(data.endsAt) : null,
            secondsLeft: Number(data.secondsLeft ?? 0),
            feedCountForHunt: Number(data.feedCountForHunt ?? 0),
            canStart: !!data.canStart,
            canClaim: !!data.canClaim,
        });
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

            await loadFarm(true);
            haptic('light');
        } catch (e: any) {
            tg?.showAlert?.(e?.message || 'Assign failed');
        } finally {
            setBusy(false);
        }
    }

    useEffect(() => {
        if (!activeMonsterId) {
            setHunt(null);
            return;
        }
        loadHuntStatus(activeMonsterId).catch(() => setHunt(null));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeMonsterId]);

    useEffect(() => {
        if (!hunt) return;
        if (hunt.status !== 'RUNNING') return;

        const t = setInterval(() => {
            setHunt((prev) => {
                if (!prev) return prev;
                const next = Math.max(0, prev.secondsLeft - 1);
                const status: HuntStatusUI = next === 0 ? 'READY' : 'RUNNING';
                return { ...prev, secondsLeft: next, status, canClaim: next === 0 };
            });
        }, 1000);

        return () => clearInterval(t);
    }, [hunt?.status]);

    useEffect(() => {
        loadFarm(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
        };
    }, []);

    function formatLeft(sec: number) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    async function startHunt(userMonsterId: number) {
        try {
            if (busy) return;
            setBusy(true);
            haptic('medium');

            const res = await apiFetch('/monsters/hunt/start', token, {
                method: 'POST',
                body: JSON.stringify({ userMonsterId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Start hunt failed');

            await loadHuntStatus(userMonsterId);
        } catch (e: any) {
            tg?.showAlert?.(e?.message || 'Start hunt failed');
        } finally {
            setBusy(false);
        }
    }

    async function claimHunt(userMonsterId: number) {
        try {
            if (busy) return;
            setBusy(true);
            haptic('heavy');

            const res = await apiFetch('/monsters/hunt/claim', token, {
                method: 'POST',
                body: JSON.stringify({ userMonsterId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Claim hunt failed');

            const r = data.reward || {};
            const msg =
                `Награда:\n` +
                `${r.stars ? `⭐ ${r.stars}\n` : ''}` +
                `${r.meat ? `🍖 ${r.meat}\n` : ''}` +
                `${r.coins ? `🪙 ${r.coins}\n` : ''}` +
                `${r.tickets ? `🎟 ${r.tickets}\n` : ''}` +
                (!r.stars && !r.meat && !r.coins && !r.tickets ? '😶 Ничего' : '');

            tg?.showAlert?.(msg);

            await loadFarm(true);
            await loadHuntStatus(userMonsterId);
        } catch (e: any) {
            tg?.showAlert?.(e?.message || 'Claim hunt failed');
        } finally {
            setBusy(false);
        }
    }

    const onRailScroll = () => {
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;

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

            const nextSlot = slots[bestIdx];
            if (!nextSlot?.monster) setHunt(null);

            setActiveIndex(bestIdx);
        });
    };

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

    // ─────────────────────────────────────────────
    // ✅ HAMSTER FAST FEED (optimistic)
    // - instant UI (no busy)
    // - request in background
    // - debounce refresh
    // ─────────────────────────────────────────────

    function applyLocalFeed(slotIndex: number) {
        // flash now
        setTapFx(Date.now());

        setSlots((prev) =>
            prev.map((s) => {
                if (s.slotIndex !== slotIndex) return s;
                if (!s.monster) return s;

                const m: any = { ...s.monster };
                const lvl = Number(m.level ?? 1);

                if (lvl >= 5) {
                    const cur = Number(m.feedCountForHunt ?? 0);
                    m.feedCountForHunt = Math.min(100, cur + 1);
                } else {
                    const xpNext = Number(m.xpNext ?? 0);
                    const nextXp = Number(m.xp ?? 0) + 1;

                    if (xpNext > 0) {
                        if (nextXp >= xpNext) {
                            m.level = Math.min(5, lvl + 1);
                            m.xp = 0;
                        } else {
                            m.xp = nextXp;
                        }
                    } else {
                        m.xp = nextXp;
                    }
                }

                return { ...s, monster: m };
            }),
        );

        // keep hunt panel counter synced when active monster is this slot monster
        const cur = activeSlot?.slotIndex === slotIndex ? activeMonster : null;
        const curId = (cur as any)?.userMonsterId;
        const slotMonsterId = (slots.find((s) => s.slotIndex === slotIndex)?.monster as any)?.userMonsterId;
        if (curId && slotMonsterId && curId === slotMonsterId) {
            setHunt((prev) => {
                if (!prev) return prev;
                if (prev.status !== 'IDLE') return prev;
                // increase only if level 5 (hunt prep)
                if ((cur as any)?.level >= 5) {
                    const next = Math.min(100, Number(prev.feedCountForHunt ?? 0) + 1);
                    return { ...prev, feedCountForHunt: next };
                }
                return prev;
            });
        }
    }

    async function feedSlotFast(slotIndex: number) {
        // throttle taps (Hamster feel)
        const now = Date.now();
        if (now - lastFeedAtRef.current < 120) return;
        lastFeedAtRef.current = now;

        const slot = slots.find((s) => s.slotIndex === slotIndex);
        if (!slot?.isUnlocked || !slot.monster) return;

        if (meat < 1) {
            tg?.showAlert?.('Нет мяса 🍖');
            return;
        }

        // only block if this exact slot monster is hunting and it’s the active one
        if (huntBlocksFeed && activeSlot?.slotIndex === slotIndex) {
            tg?.showAlert?.('Монстр на охоте ⏳');
            return;
        }

        // ✅ instant feedback
        haptic('light');
        setMeat((m) => Math.max(0, m - 1));
        applyLocalFeed(slotIndex);

        // send request in background (one at a time)
        if (feedLockRef.current) return;
        feedLockRef.current = true;

        try {
            const res = await apiFetch('/monsters/farm/feed', token, {
                method: 'POST',
                body: JSON.stringify({ slotIndex }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                // rollback meat (simple rollback; state will be re-synced by refresh too)
                setMeat((m) => m + 1);
                tg?.showAlert?.(data.message || 'Feed failed');
                // re-sync soon
                if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = window.setTimeout(() => loadFarm(true), 350);
                return;
            }

            if (typeof data.meatLeft === 'number') setMeat(Number(data.meatLeft));

            // debounce refresh (so you can tap spam)
            if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
            refreshTimerRef.current = window.setTimeout(() => {
                loadFarm(true);
                if (activeMonsterId) loadHuntStatus(activeMonsterId).catch(() => {});
            }, 900);
        } finally {
            // tiny delay so taps feel free but we don't spam parallel calls
            window.setTimeout(() => {
                feedLockRef.current = false;
            }, 90);
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

    // ===== Skeleton (no "Loading..." text)
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
                    <div className="farm-title">Monsters</div>
                    <button type="button" className="farm-refresh" onClick={() => loadFarm(true)}>
                        ⟳
                    </button>
                </div>

                <div className="farm-skeleton">
                    <div className="sk-card" />
                    <div className="sk-dots" />
                    <div className="sk-bottom" />
                </div>
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
                    <div className="farm-title">Monsters</div>
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
                    <div className="farm-title">Monsters</div>
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

    const bottomStatus =
        !activeSlot?.isUnlocked
            ? 'LOCKED'
            : !activeMonster
                ? 'EMPTY'
                : huntBlocksFeed
                    ? 'HUNTING'
                    : meat < 1
                        ? 'NO_MEAT'
                        : canFeedActive
                            ? 'READY_FEED'
                            : 'IDLE';

    const localFeedCount =
        (activeMonster as any)?.level >= 5 ? Number((activeMonster as any)?.feedCountForHunt ?? 0) : 0;

    const huntFeedShown =
        typeof hunt?.feedCountForHunt === 'number'
            ? hunt.feedCountForHunt
            : localFeedCount;

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

                <div className="farm-title">Monsters</div>

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
                        huntBlocksFeed={huntBlocksFeed && idx === activeIndex}
                        showCornerHunt={
                            idx === activeIndex &&
                            showHuntPanel &&
                            (hunt?.status === 'IDLE' && !!hunt?.canStart)
                        }
                        cornerHuntText="HUNT READY"
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

                            if (huntBlocksFeed && idx === activeIndex) {
                                tg?.showAlert?.('Монстр на охоте ⏳');
                                return;
                            }

                            // ✅ FAST FEED
                            feedSlotFast(slot.slotIndex);
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
            <div className="farm-bottom" data-status={bottomStatus}>
                <div className="farm-bottom-left">
                    {showHuntPanel && (
                        <div className="farm-hunt-row" data-status={hunt?.status || 'IDLE'}>
                            <div className="farm-hunt-info">
                                {hunt?.status === 'RUNNING' ? (
                                    <span className="farm-hunt-running">
                    🏹 On hunt · ⏳ {formatLeft(hunt.secondsLeft)}
                  </span>
                                ) : hunt?.status === 'READY' ? (
                                    <span className="farm-hunt-ready">🏹 Finished · 🎁 Claim reward</span>
                                ) : (
                                    <span className="farm-hunt-feed">🏹 Feed for hunt {huntFeedShown}/100</span>
                                )}
                            </div>

                            <div className="farm-hunt-actions">
                                {hunt?.status === 'IDLE' && (
                                    <button
                                        type="button"
                                        className="farm-mini"
                                        disabled={busy || !hunt?.canStart}
                                        onClick={() => activeMonsterId && startHunt(activeMonsterId)}
                                    >
                                        Start
                                    </button>
                                )}

                                {hunt?.status === 'READY' && (
                                    <button
                                        type="button"
                                        className="farm-mini farm-mini--gold"
                                        disabled={busy || !hunt?.canClaim}
                                        onClick={() => activeMonsterId && claimHunt(activeMonsterId)}
                                    >
                                        Claim
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="farm-bottom-name">
                        {activeSlot?.isUnlocked
                            ? activeMonster
                                ? activeMonster.name
                                : `Slot #${activeSlot.slotIndex}`
                            : `Slot #${activeSlot?.slotIndex}`}
                    </div>

                    <div className="farm-bottom-sub">
                        {!activeSlot?.isUnlocked
                            ? `Locked · ${activeSlot?.unlockPrice ?? 0} 🪙`
                            : !activeMonster
                                ? 'Empty slot · Assign a monster'
                                : huntBlocksFeed
                                    ? 'On hunt · feeding disabled'
                                    : meat < 1
                                        ? 'No meat 🍖'
                                        : activeMonster.level >= 5
                                            ? `Feed for hunt: ${huntFeedShown}/100`
                                            : 'Tap monster card to feed'}
                    </div>

                    {activeSlot?.isUnlocked && activeMonster && (
                        <div className="farm-inline-pills">
                            <div className="pill">
                                <span className="pill-ico">🍖</span>
                                <span className="pill-val">{meat}</span>
                            </div>

                            {typeof activeMonster.level === 'number' && (
                                <div className="pill pill--soft">
                                    <span className="pill-ico">LVL</span>
                                    <span className="pill-val">{activeMonster.level}</span>
                                </div>
                            )}

                            {activeMonster.level >= 5 && (
                                <div className="pill pill--soft">
                                    <span className="pill-ico">🏹</span>
                                    <span className="pill-val">{huntFeedShown}/100</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* right action */}
                {activeSlot && !activeSlot.isUnlocked ? (
                    <button type="button" className="farm-primary" disabled={!canUnlock} onClick={unlockActive}>
                        Unlock
                    </button>
                ) : activeSlot?.isUnlocked && !activeSlot?.monster ? (
                    <button
                        type="button"
                        className="farm-primary"
                        disabled={busy}
                        onClick={() => activeSlot && openPicker(activeSlot.slotIndex)}
                    >
                        Assign
                    </button>
                ) : (
                    <button type="button" className="farm-ghost" disabled aria-label="hint" title="Tap monster card">
                        {canFeedActive
                            ? activeMonster?.level >= 5
                                ? 'Feed for hunt'
                                : 'Feed'
                            : meat < 1
                                ? 'Need meat'
                                : huntBlocksFeed
                                    ? 'Hunt'
                                    : 'Ready'}
                    </button>
                )}
            </div>

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
                   huntBlocksFeed,
                   showCornerHunt,
                   cornerHuntText,
               }: {
    slot: FarmSlot;
    isActive: boolean;
    onClick: () => void;
    onAssign: () => void;
    busy: boolean;
    meat: number;
    tapFx: number;
    huntBlocksFeed?: boolean;
    showCornerHunt?: boolean;
    cornerHuntText?: string;
}) {
    const m = slot.monster;

    const rarityKey = m ? String(m.rarity).toLowerCase() : 'common';
    const rarityClass = m ? `rarity-${rarityKey}` : '';

    const isMaxLevel = !!m && Number((m as any).level) >= 5;

    const feedNow = isMaxLevel ? Number((m as any).feedCountForHunt ?? 0) : 0;
    const feedMax = 100;

    const xpNext = Number((m as any)?.xpNext ?? 0);
    const xpNow = Number((m as any)?.xp ?? 0);

    const barPct = isMaxLevel
        ? Math.max(0, Math.min(100, (feedNow / feedMax) * 100))
        : xpNext > 0
            ? Math.max(0, Math.min(100, (xpNow / xpNext) * 100))
            : 0;

    // note: keep busy only for visuals; feed itself is not blocked by busy in parent
    const isFeedable = !!slot.isUnlocked && !!m && meat >= 1 && !huntBlocksFeed;

    return (
        <div className={`farm-slide ${isActive ? 'farm-slide--active' : ''}`}>
            <button
                type="button"
                className={`farm-card ${slot.isUnlocked ? '' : 'farm-card--locked'} ${
                    isFeedable ? 'farm-card--tap' : ''
                }`}
                onClick={onClick}
                data-prog={isMaxLevel ? 'hunt' : 'xp'} // ✅ allows hunt-specific styling if you add CSS
            >
                <div className="farm-card-bg" />

                {isActive && <div key={tapFx} className="farm-tap-flash" />}

                <div className="farm-card-top">
                    <div className="farm-chip">#{slot.slotIndex}</div>
                    {m ? <div className={`farm-chip farm-chip--rarity ${rarityClass}`}>{m.rarity}</div> : <div />}
                </div>

                {showCornerHunt && (
                    <div className="farm-corner-tag" title="Hunt available">
                        <span className="ct-ico">🏹</span>
                        <span className="ct-txt">{cornerHuntText || 'HUNT READY'}</span>
                    </div>
                )}

                {!slot.isUnlocked ? (
                    <div className="farm-locked">
                        <div className="farm-locked-emoji">🔒</div>
                        <div className="farm-locked-title">Locked</div>
                        <div className="farm-locked-sub">Unlock: {slot.unlockPrice} 🪙</div>
                    </div>
                ) : !m ? (
                    <div className="farm-empty-card">
                        <div className="farm-empty-emoji">➕</div>
                        <div className="farm-empty-title">Empty slot</div>
                        <div className="farm-empty-sub">Select a monster from collection</div>

                        <div
                            className="farm-assign-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAssign();
                            }}
                            role="button"
                            tabIndex={0}
                        >
                            Assign monster
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

                        <div className="farm-name-wrap">
                            <div className={`farm-monster-name ${rarityClass}`}>{m.name}</div>
                            <div className="farm-monster-level">LVL {m.level}</div>
                        </div>

                        <div className="farm-xpbar">
                            <div className="farm-xpfill" style={{ width: `${barPct}%` }} />
                            <div className="farm-xpglow" />
                        </div>

                        <div className="farm-xptext">
                            {isMaxLevel ? (
                                <>🏹 Feed for hunt {feedNow} / {feedMax}</>
                            ) : (
                                <>XP {xpNow} / {xpNext || '—'}</>
                            )}
                        </div>

                        <div className="farm-card-footer">
                            <div
                                className={`farm-status-pill ${
                                    busy ? 'is-busy' : isFeedable ? 'is-good' : meat < 1 ? 'is-warn' : 'is-idle'
                                }`}
                            >
                                {huntBlocksFeed
                                    ? 'On hunt ⏳'
                                    : isFeedable
                                        ? isMaxLevel
                                            ? 'Feed for hunt'
                                            : 'Tap to feed'
                                        : meat < 1
                                            ? 'Need meat 🍖'
                                            : 'Tap'}
                            </div>
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
                    <div className="picker-title">My Monsters</div>
                    <button type="button" className="picker-close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="picker-list">
                    {monsters.length === 0 ? (
                        <div className="picker-empty">
                            <div className="picker-empty-emoji">🫥</div>
                            <div className="picker-empty-title">No monsters yet</div>
                            <div className="picker-empty-sub">Play and catch some monsters first.</div>
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