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

type MonsterCenterView = 'farm' | 'fusion' | 'summon';

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

    // ─────────────────────────────────────────────
    // ✅ FIX: queue-based Hamster feed (no rollback)
    // - every tap goes to queue
    // - one pump sends ALL taps to backend
    // - UI is instant
    // ─────────────────────────────────────────────
    const feedQueueRef = useRef<Record<number, number>>({}); // slotIndex -> pending taps
    const feedingRef = useRef(false);
    const lastTapRef = useRef(0);
    const refreshTimerRef = useRef<number | null>(null);

    const [hunt, setHunt] = useState<HuntInfo | null>(null);
    const [slots, setSlots] = useState<FarmSlot[]>([]);
    const [meat, setMeat] = useState<number>(0);

    const [activeIndex, setActiveIndex] = useState(0);
    const [view, setView] = useState<MonsterCenterView>('farm');

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
    const canFeedActive = !!activeSlot?.isUnlocked && !!activeMonster && meat >= 1 && !huntBlocksFeed;

    const showHuntPanel =
        !!activeSlot?.isUnlocked &&
        !!activeMonster &&
        (activeMonster as any).level >= 5 &&
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
            // clear queue on unmount (safe)
            feedQueueRef.current = {};
            feedingRef.current = false;
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
    // ✅ Local optimistic state (XP or Hunt progress)
    // ─────────────────────────────────────────────
    function applyLocalFeed(slotIndex: number) {
        setTapFx(Date.now());

        // update slots (XP or feedCountForHunt)
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

                    if (xpNext > 0 && nextXp >= xpNext) {
                        m.level = Math.min(5, lvl + 1);
                        m.xp = 0;
                    } else {
                        m.xp = nextXp;
                    }
                }

                return { ...s, monster: m };
            }),
        );

        // sync hunt panel counter for ACTIVE monster too
        setHunt((prev) => {
            if (!prev) return prev;
            if (prev.status !== 'IDLE') return prev;

            // only for active slot
            if (activeSlot?.slotIndex !== slotIndex) return prev;

            // only if level 5
            if (Number((activeMonster as any)?.level ?? 0) < 5) return prev;

            const next = Math.min(100, Number(prev.feedCountForHunt ?? 0) + 1);
            return { ...prev, feedCountForHunt: next };
        });
    }

    // ─────────────────────────────────────────────
    // ✅ FEED FAST: enqueue tap -> pump sends ALL
    // ─────────────────────────────────────────────
    async function feedSlotFast(slotIndex: number) {
        // hamster throttle (feel free to lower to 25-40)
        const now = Date.now();
        if (now - lastTapRef.current < 35) return;
        lastTapRef.current = now;

        const slot = slots.find((s) => s.slotIndex === slotIndex);
        if (!slot?.isUnlocked || !slot.monster) return;

        if (meat < 1) {
            tg?.showAlert?.('Нет мяса 🍖');
            return;
        }

        // only block if this exact slot is active and hunting
        if (huntBlocksFeed && activeSlot?.slotIndex === slotIndex) {
            tg?.showAlert?.('Монстр на охоте ⏳');
            return;
        }

        // ✅ instant UI
        haptic('light');
        setMeat((m) => Math.max(0, m - 1));
        applyLocalFeed(slotIndex);

        // ✅ enqueue ALWAYS (this fixes your rollback 100 -> 75)
        feedQueueRef.current[slotIndex] = (feedQueueRef.current[slotIndex] ?? 0) + 1;

        // already pumping
        if (feedingRef.current) return;

        feedingRef.current = true;

        try {
            while (true) {
                const entries = Object.entries(feedQueueRef.current).filter(([, v]) => v > 0);
                if (entries.length === 0) break;

                // prioritize current tapped slot
                const pickKey = feedQueueRef.current[slotIndex] ? String(slotIndex) : entries[0][0];
                const si = Number(pickKey);

                // consume 1 tap
                feedQueueRef.current[si] = Math.max(0, (feedQueueRef.current[si] ?? 0) - 1);

                const res = await apiFetch('/monsters/farm/feed', token, {
                    method: 'POST',
                    body: JSON.stringify({ slotIndex: si }),
                });

                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    // backend rejected -> hard resync & clear queue
                    feedQueueRef.current = {};
                    tg?.showAlert?.(data.message || 'Feed failed');
                    await loadFarm(true);
                    if (activeMonsterId) await loadHuntStatus(activeMonsterId).catch(() => {});
                    break;
                }

                // keep meat synced if backend returns it
                if (typeof data.meatLeft === 'number') setMeat(Number(data.meatLeft));

                // tiny delay keeps DB happy but still super fast
                await new Promise((r) => setTimeout(r, 10));
            }

            // one quiet resync after burst
            if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
            refreshTimerRef.current = window.setTimeout(() => {
                loadFarm(true);
                if (activeMonsterId) loadHuntStatus(activeMonsterId).catch(() => {});
            }, 250);
        } finally {
            feedingRef.current = false;
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

    // show hunt feed progress correctly (never 0/0)
    const localFeedCount =
        Number((activeMonster as any)?.level ?? 0) >= 5 ? Number((activeMonster as any)?.feedCountForHunt ?? 0) : 0;

    const huntFeedShown = typeof hunt?.feedCountForHunt === 'number' ? hunt.feedCountForHunt : localFeedCount;

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

            <div className="farm-tabs">
                <button
                    type="button"
                    className={`farm-tab ${view === 'farm' ? 'farm-tab--active' : ''}`}
                    onClick={() => setView('farm')}
                >
                    Farm
                </button>
                <button
                    type="button"
                    className={`farm-tab ${view === 'fusion' ? 'farm-tab--active' : ''}`}
                    onClick={() => setView('fusion')}
                >
                    Fusion Lab
                </button>
                <button
                    type="button"
                    className={`farm-tab ${view === 'summon' ? 'farm-tab--active' : ''}`}
                    onClick={() => setView('summon')}
                >
                    Summon
                </button>
            </div>

            {view === 'farm' && (
                <>
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
                                showCornerHunt={idx === activeIndex && showHuntPanel && hunt?.status === 'IDLE' && !!hunt?.canStart}
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

                                    feedSlotFast(slot.slotIndex);
                                }}
                            />
                        ))}
                    </div>

                    {/* ===== Dots ===== */}
                    <div className="farm-dots">
                        {slots.map((s, i) => {
                            const cls = i === activeIndex ? 'dot dot--active' : s.isUnlocked ? 'dot' : 'dot dot--locked';
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
                                            <span className="farm-hunt-running">🏹 On hunt · ⏳ {formatLeft(hunt.secondsLeft)}</span>
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
                                        ? (activeMonster as any).name
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
                                                : Number((activeMonster as any).level ?? 0) >= 5
                                                    ? `Feed for hunt: ${huntFeedShown}/100`
                                                    : 'Tap monster card to feed'}
                            </div>

                            {activeSlot?.isUnlocked && activeMonster && (
                                <div className="farm-inline-pills">
                                    <div className="pill">
                                        <span className="pill-ico">🍖</span>
                                        <span className="pill-val">{meat}</span>
                                    </div>

                                    {typeof (activeMonster as any).level === 'number' && (
                                        <div className="pill pill--soft">
                                            <span className="pill-ico">LVL</span>
                                            <span className="pill-val">{Number((activeMonster as any).level)}</span>
                                        </div>
                                    )}

                                    {Number((activeMonster as any).level ?? 0) >= 5 && (
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
                                    ? Number((activeMonster as any)?.level ?? 0) >= 5
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
                </>
            )}

            {view === 'fusion' && <FusionLabView token={token} />}

            {view === 'summon' && <SummonView token={token} />}
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
    const m = slot.monster as any;

    const rarityKey = m ? String(m.rarity).toLowerCase() : 'common';
    const rarityClass = m ? `rarity-${rarityKey}` : '';

    const isMaxLevel = !!m && Number(m.level) >= 5;

    const feedNow = isMaxLevel ? Number(m.feedCountForHunt ?? 0) : 0;
    const feedMax = 100;

    const xpNext = Number(m?.xpNext ?? 0);
    const xpNow = Number(m?.xp ?? 0);

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
                className={`farm-card ${slot.isUnlocked ? '' : 'farm-card--locked'} ${isFeedable ? 'farm-card--tap' : ''}`}
                onClick={onClick}
                data-prog={isMaxLevel ? 'hunt' : 'xp'}
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
                            <div className="farm-monster-level">LVL {Number(m.level)}</div>
                        </div>

                        <div className="farm-xpbar">
                            <div className="farm-xpfill" style={{ width: `${barPct}%` }} />
                            <div className="farm-xpglow" />
                        </div>

                        <div className="farm-xptext">
                            {isMaxLevel ? (
                                <>
                                    🏹 Feed for hunt {feedNow} / {feedMax}
                                </>
                            ) : (
                                <>
                                    XP {xpNow} / {xpNext || '—'}
                                </>
                            )}
                        </div>

                        <div className="farm-card-footer">
                            <div className={`farm-status-pill ${busy ? 'is-busy' : isFeedable ? 'is-good' : meat < 1 ? 'is-warn' : 'is-idle'}`}>
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

type FusionIngredientType = 'MONSTER' | 'TOKEN';

interface FusionToken {
    id: string;
    name: string;
    description?: string;
    count: number;
}

interface FusionPreviewOutcome {
    id: string;
    name: string;
    rarity: string;
    imgUrl?: string;
    description?: string;
}

interface FusionPreviewResponse {
    mode: 'BASIC' | 'PREMIUM';
    costCoins?: number;
    costStars?: number;
    message?: string;
    result?: FusionPreviewOutcome | null;
    options?: FusionPreviewOutcome[]; // for PREMIUM (3 options)
}

interface FusionExecuteResponse {
    success: boolean;
    message?: string;
    outcome?: FusionPreviewOutcome | null;
}

function safeErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message || fallback;
    if (typeof err === 'string') return err;
    return fallback;
}

function FusionLabView({ token }: { token: string }) {
    const [collection, setCollection] = useState<CollectionMonster[]>([]);
    const [tokens, setTokens] = useState<FusionToken[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [primaryId, setPrimaryId] = useState<number | ''>('');
    const [ingredientType, setIngredientType] = useState<FusionIngredientType>('MONSTER');
    const [secondaryMonsterId, setSecondaryMonsterId] = useState<number | ''>('');
    const [secondaryTokenId, setSecondaryTokenId] = useState<string | ''>('');

    const [protection, setProtection] = useState(false);
    const [premium, setPremium] = useState(false);

    const [preview, setPreview] = useState<FusionPreviewResponse | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [executeLoading, setExecuteLoading] = useState(false);
    const [executeMessage, setExecuteMessage] = useState<string | null>(null);

    const tg = (window as any).Telegram?.WebApp;

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const [collRes, optRes] = await Promise.all([
                    apiFetch('/monsters/collection', token),
                    apiFetch('/monsters/fusion/options', token).catch(() => null),
                ]);

                const collData = await collRes.json().catch(() => ({}));
                if (!collRes.ok) throw new Error(collData.message || 'Failed to load collection');

                if (!cancelled) {
                    setCollection((collData.monsters ?? []) as CollectionMonster[]);
                }

                if (optRes && !cancelled) {
                    const optData = await optRes.json().catch(() => ({}));
                    setTokens((optData.tokens ?? []) as FusionToken[]);
                }
            } catch (e) {
                const msg = safeErrorMessage(e, 'Не удалось загрузить Fusion Lab');
                console.error(e);
                if (!cancelled) setError(msg);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [token]);

    const canPreview =
        !!primaryId &&
        ((ingredientType === 'MONSTER' && !!secondaryMonsterId) ||
            (ingredientType === 'TOKEN' && !!secondaryTokenId));

    const handlePreview = async () => {
        if (!canPreview || !primaryId) {
            setError('Выбери основного монстра и вторую сущность');
            return;
        }
        setPreviewLoading(true);
        setError(null);
        setExecuteMessage(null);

        try {
            const body: any = {
                primaryUserMonsterId: primaryId,
                ingredientType,
                protection,
                premium,
            };

            if (ingredientType === 'MONSTER') {
                body.secondaryUserMonsterId = secondaryMonsterId;
            } else {
                body.tokenId = secondaryTokenId;
            }

            const res = await apiFetch('/monsters/fusion/preview', token, {
                method: 'POST',
                body: JSON.stringify(body),
            });
            const data = (await res.json().catch(() => ({}))) as FusionPreviewResponse & { message?: string };
            if (!res.ok) throw new Error(data.message || 'Не удалось получить предварительный результат слияния');

            setPreview(data);
        } catch (e) {
            const msg = safeErrorMessage(e, 'Ошибка предварительного расчёта слияния');
            console.error(e);
            setError(msg);
            tg?.showAlert?.(msg);
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleExecute = async (chosenId?: string, revealAll?: boolean) => {
        if (!canPreview || !primaryId) {
            setError('Сначала сделай превью слияния');
            return;
        }

        setExecuteLoading(true);
        setError(null);
        setExecuteMessage(null);

        try {
            const body: any = {
                primaryUserMonsterId: primaryId,
                ingredientType,
                protection,
                premium,
                chosenOutcomeId: chosenId,
                revealAll: !!revealAll,
            };

            if (ingredientType === 'MONSTER') {
                body.secondaryUserMonsterId = secondaryMonsterId;
            } else {
                body.tokenId = secondaryTokenId;
            }

            const res = await apiFetch('/monsters/fusion/execute', token, {
                method: 'POST',
                body: JSON.stringify(body),
            });
            const data = (await res.json().catch(() => ({}))) as FusionExecuteResponse & { message?: string };
            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Слияние не удалось');
            }

            const outcome = data.outcome;
            const msg =
                outcome && outcome.name
                    ? `Слияние успешно!\n${outcome.name} · ${outcome.rarity}`
                    : data.message || 'Слияние успешно';

            setExecuteMessage(msg);
            tg?.showAlert?.(msg);
        } catch (e) {
            const msg = safeErrorMessage(e, 'Ошибка выполнения слияния');
            console.error(e);
            setError(msg);
            tg?.showAlert?.(msg);
        } finally {
            setExecuteLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="farm-panel">
                <div className="farm-section-title">Fusion Lab</div>
                <div className="farm-muted">Загружаем коллекцию монстров...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="farm-panel">
                <div className="farm-section-title">Fusion Lab</div>
                <div className="farm-error">{error}</div>
                <button type="button" className="farm-primary" onClick={() => window.location.reload()}>
                    🔄 Перезагрузить
                </button>
            </div>
        );
    }

    return (
        <div className="farm-panel">
            <div className="farm-section-title">🧪 Fusion Lab</div>
            <div className="farm-muted">Выбери базового монстра и вторую сущность для слияния.</div>

            <div className="fusion-row">
                <div className="fusion-col">
                    <div className="farm-label">Монстр A (основной)</div>
                    <select
                        className="farm-select"
                        value={primaryId === '' ? '' : String(primaryId)}
                        onChange={(e) => setPrimaryId(e.target.value ? Number(e.target.value) : '')}
                    >
                        <option value="">— выбери монстра —</option>
                        {collection.map((m) => (
                            <option key={m.userMonsterId} value={m.userMonsterId}>
                                #{m.userMonsterId} · {m.name} · lvl {m.level} · {m.rarity}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="fusion-col">
                    <div className="farm-label">Второй ресурс</div>
                    <div className="fusion-toggle-row">
                        <button
                            type="button"
                            className={`fusion-toggle ${ingredientType === 'MONSTER' ? 'is-active' : ''}`}
                            onClick={() => setIngredientType('MONSTER')}
                        >
                            Монстр B
                        </button>
                        <button
                            type="button"
                            className={`fusion-toggle ${ingredientType === 'TOKEN' ? 'is-active' : ''}`}
                            onClick={() => setIngredientType('TOKEN')}
                        >
                            Токен
                        </button>
                    </div>

                    {ingredientType === 'MONSTER' ? (
                        <select
                            className="farm-select"
                            value={secondaryMonsterId === '' ? '' : String(secondaryMonsterId)}
                            onChange={(e) =>
                                setSecondaryMonsterId(e.target.value ? Number(e.target.value) : '')
                            }
                        >
                            <option value="">— выбери монстра B —</option>
                            {collection
                                .filter((m) => m.userMonsterId !== primaryId)
                                .map((m) => (
                                    <option key={m.userMonsterId} value={m.userMonsterId}>
                                        #{m.userMonsterId} · {m.name} · lvl {m.level} · {m.rarity}
                                    </option>
                                ))}
                        </select>
                    ) : (
                        <select
                            className="farm-select"
                            value={secondaryTokenId}
                            onChange={(e) => setSecondaryTokenId(e.target.value)}
                        >
                            <option value="">— выбери токен —</option>
                            {tokens.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name} · x{t.count}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            <div className="fusion-row fusion-row--toggles">
                <label className="fusion-switch">
                    <input
                        type="checkbox"
                        checked={protection}
                        onChange={(e) => setProtection(e.target.checked)}
                    />
                    <span>Защита монстра A (если поддерживается бэком)</span>
                </label>
                <label className="fusion-switch">
                    <input
                        type="checkbox"
                        checked={premium}
                        onChange={(e) => setPremium(e.target.checked)}
                    />
                    <span>Премиум режим (3 варианта)</span>
                </label>
            </div>

            <div className="fusion-actions">
                <button
                    type="button"
                    className="farm-primary"
                    disabled={!canPreview || previewLoading}
                    onClick={handlePreview}
                >
                    {previewLoading ? 'Считаем...' : '🔍 Превью'}
                </button>
            </div>

            {preview && (
                <div className="fusion-preview">
                    <div className="farm-section-title">
                        {preview.mode === 'PREMIUM' ? 'Премиум-превью (3 опции)' : 'Результат превью'}
                    </div>
                    {preview.message && <div className="farm-muted">{preview.message}</div>}

                    {preview.mode === 'BASIC' && preview.result && (
                        <div className="fusion-result-card">
                            <div className="fusion-result-name">
                                {preview.result.name} · {preview.result.rarity}
                            </div>
                            {preview.result.description && (
                                <div className="fusion-result-desc">{preview.result.description}</div>
                            )}
                            <button
                                type="button"
                                className="farm-primary"
                                disabled={executeLoading}
                                onClick={() => handleExecute()}
                            >
                                {executeLoading ? 'Выполняем...' : '✅ Выполнить слияние'}
                            </button>
                        </div>
                    )}

                    {preview.mode === 'PREMIUM' && Array.isArray(preview.options) && (
                        <div className="fusion-options-grid">
                            {preview.options.map((opt) => (
                                <div key={opt.id} className="fusion-option-card">
                                    <div className="fusion-result-name">
                                        {opt.name} · {opt.rarity}
                                    </div>
                                    {opt.description && (
                                        <div className="fusion-result-desc">{opt.description}</div>
                                    )}
                                    <button
                                        type="button"
                                        className="farm-primary"
                                        disabled={executeLoading}
                                        onClick={() => handleExecute(opt.id, false)}
                                    >
                                        {executeLoading ? '...' : 'Выбрать'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {preview.mode === 'PREMIUM' && (
                        <div className="fusion-premium-actions">
                            <button
                                type="button"
                                className="farm-secondary"
                                disabled={executeLoading}
                                onClick={() => handleExecute(undefined, true)}
                            >
                                {executeLoading ? '...' : '🔎 Reveal all'}
                            </button>
                            <button
                                type="button"
                                className="farm-secondary"
                                disabled={previewLoading || executeLoading}
                                onClick={handlePreview}
                            >
                                Перебросить (reroll)
                            </button>
                        </div>
                    )}

                    {executeMessage && <div className="farm-success">{executeMessage}</div>}
                </div>
            )}
        </div>
    );
}

interface SummonHistoryItem {
    id: string;
    name: string;
    rarity: string;
    obtainedAt: string;
}

interface SummonStatusResponse {
    pityCurrent: number;
    pityMax: number;
    history: SummonHistoryItem[];
}

interface SummonResponse {
    pityCurrent: number;
    pityMax: number;
    pulls: SummonHistoryItem[];
    message?: string;
}

function SummonView({ token }: { token: string }) {
    const [status, setStatus] = useState<SummonStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [summoning, setSummoning] = useState(false);
    const [lastPulls, setLastPulls] = useState<SummonHistoryItem[]>([]);

    const tg = (window as any).Telegram?.WebApp;

    const loadStatus = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch('/monsters/summon/status', token);
            const data = (await res.json().catch(() => ({}))) as SummonStatusResponse & { message?: string };
            if (!res.ok) throw new Error(data.message || 'Не удалось загрузить статус призыва');
            setStatus({
                pityCurrent: Number(data.pityCurrent ?? 0),
                pityMax: Number(data.pityMax ?? 1),
                history: Array.isArray(data.history) ? data.history : [],
            });
        } catch (e) {
            const msg = safeErrorMessage(e, 'Ошибка загрузки статуса призыва');
            console.error(e);
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const handleSummon = async (count: 1 | 10) => {
        if (summoning) return;
        setSummoning(true);
        setError(null);
        try {
            const res = await apiFetch('/monsters/summon', token, {
                method: 'POST',
                body: JSON.stringify({ count }),
            });
            const data = (await res.json().catch(() => ({}))) as SummonResponse & { message?: string };
            if (!res.ok) throw new Error(data.message || 'Не удалось выполнить призыв');

            setLastPulls(data.pulls ?? []);
            setStatus({
                pityCurrent: Number(data.pityCurrent ?? status?.pityCurrent ?? 0),
                pityMax: Number(data.pityMax ?? status?.pityMax ?? 1),
                history: [
                    ...(data.pulls ?? []),
                    ...(status?.history ?? []),
                ].slice(0, 50),
            });

            const names = (data.pulls ?? []).map((p) => `${p.name} [${p.rarity}]`).join('\n');
            const msg =
                data.message ||
                (names ? `Новые монстры:\n${names}` : 'Призыв выполнен, но сервер не вернул монстров');
            tg?.showAlert?.(msg);
        } catch (e) {
            const msg = safeErrorMessage(e, 'Ошибка призыва монстров');
            console.error(e);
            setError(msg);
            tg?.showAlert?.(msg);
        } finally {
            setSummoning(false);
        }
    };

    const pityPct =
        status && status.pityMax > 0
            ? Math.max(0, Math.min(1, status.pityCurrent / status.pityMax))
            : 0;

    return (
        <div className="farm-panel">
            <div className="farm-section-title">🔮 Summon</div>

            {loading && <div className="farm-muted">Загружаем баннер призыва...</div>}
            {error && <div className="farm-error">{error}</div>}

            {status && (
                <>
                    <div className="summon-pity">
                        <div className="summon-pity-row">
                            <span>Pity</span>
                            <span>
                                {status.pityCurrent} / {status.pityMax}
                            </span>
                        </div>
                        <div className="summon-pity-bar">
                            <div
                                className="summon-pity-fill"
                                style={{ transform: `scaleX(${pityPct})` }}
                            />
                        </div>
                        <div className="summon-pity-note">
                            Гарантированный редкий/легендарный монстр, когда шкала заполнится.
                        </div>
                    </div>

                    <div className="summon-actions">
                        <button
                            type="button"
                            className="summon-btn"
                            disabled={summoning}
                            onClick={() => handleSummon(1)}
                        >
                            {summoning ? '...' : '🎲 Призыв x1'}
                        </button>
                        <button
                            type="button"
                            className="summon-btn summon-btn--gold"
                            disabled={summoning}
                            onClick={() => handleSummon(10)}
                        >
                            {summoning ? '...' : '🔥 Призыв x10'}
                        </button>
                    </div>

                    {lastPulls.length > 0 && (
                        <div className="summon-last">
                            <div className="farm-section-title">Последний призыв</div>
                            <div className="summon-grid">
                                {lastPulls.map((p) => (
                                    <div key={p.id} className={`summon-card rarity-${p.rarity.toLowerCase()}`}>
                                        <div className="summon-name">{p.name}</div>
                                        <div className="summon-sub">{p.rarity}</div>
                                        <div className="summon-time">
                                            {new Date(p.obtainedAt).toLocaleTimeString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="summon-history">
                        <div className="farm-section-title">История призывов</div>
                        {status.history.length === 0 ? (
                            <div className="farm-muted">Пока нет истории. Сделай первый призыв.</div>
                        ) : (
                            <div className="summon-history-list">
                                {status.history.map((p) => (
                                    <div key={p.id} className="summon-history-row">
                                        <span className="summon-history-name">
                                            {p.name} · {p.rarity}
                                        </span>
                                        <span className="summon-history-time">
                                            {new Date(p.obtainedAt).toLocaleString()}
                                        </span>
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