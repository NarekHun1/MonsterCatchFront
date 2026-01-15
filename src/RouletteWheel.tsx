import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from './api';
import './RouletteWheel.css';

type PrizeType = 'COINS' | 'TICKETS' | 'STARS' | 'NOTHING' | 'JACKPOT';

type Sector = {
    id: string;
    title: string;      // 10 / 2500 / UNCOMMON ...
    subtitle?: string;  // "УТКА" или "x10" и т.п.
    icon: string;       // emoji или можно потом сделать <img/>
};

type SpinResponse = {
    sectorId: string;
    label?: string;
    type?: PrizeType;
    amount?: number;
    costCoins?: number;
    freeTodayUsed?: boolean;
};

const DEFAULT_SECTORS: Sector[] = [
    { id: 'duck', title: 'UNCOMMON', subtitle: 'УТКА', icon: '🦆' },
    { id: 'blue_10', title: '10', icon: '🌀' },
    { id: 'coins_2500', title: '2500', icon: '🟩' },
    { id: 'blue_100', title: '100', icon: '🌀' },
    { id: 'x1', title: '1', icon: '🟣' },
    { id: 'x5', title: '5', icon: '🟪' },
    { id: 'coins_100', title: '100', icon: '🟡' },
    { id: 'nothing', title: '0', icon: '❌' },
];

function easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
}

/** lock scroll behind modal (Telegram/iOS safe) */
function useBodyScrollLock(enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;

        const body = document.body;
        const html = document.documentElement;
        const scrollY = window.scrollY || 0;

        const prev = {
            bodyPos: body.style.position,
            bodyTop: body.style.top,
            bodyLeft: body.style.left,
            bodyRight: body.style.right,
            bodyWidth: body.style.width,
            bodyOverflow: body.style.overflow,
            htmlOverflow: html.style.overflow,
        };

        body.style.position = 'fixed';
        body.style.top = `-${scrollY}px`;
        body.style.left = '0';
        body.style.right = '0';
        body.style.width = '100%';
        body.style.overflow = 'hidden';
        html.style.overflow = 'hidden';

        return () => {
            body.style.position = prev.bodyPos;
            body.style.top = prev.bodyTop;
            body.style.left = prev.bodyLeft;
            body.style.right = prev.bodyRight;
            body.style.width = prev.bodyWidth;
            body.style.overflow = prev.bodyOverflow;
            html.style.overflow = prev.htmlOverflow;
            window.scrollTo(0, scrollY);
        };
    }, [enabled]);
}

export function RouletteWheel({
                                  token,
                                  onClose,
                                  onReward,
                                  coins,
                                  spinCost = 100,           // как на скрине “100”
                                  dailyFreeText = '1 раз в день',
                              }: {
    token: string | null;
    onClose: () => void;
    onReward?: (reward: SpinResponse) => void;

    coins?: number;
    tickets?: number;
    stars?: number;

    spinCost?: number;
    dailyFreeText?: string;
}) {
    useBodyScrollLock(true);

    // Telegram back button closes sheet
    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (!tg) return;

        tg.ready?.();
        tg.BackButton?.show();
        tg.BackButton?.onClick(onClose);

        return () => {
            tg.BackButton?.offClick(onClose);
            tg.BackButton?.hide();
        };
    }, [onClose]);

    const sectors = useMemo(() => DEFAULT_SECTORS, []);
    const sectorAngle = 360 / sectors.length;

    const [angle, setAngle] = useState(0);
    const [spinning, setSpinning] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<SpinResponse | null>(null);
    const [winningId, setWinningId] = useState<string | null>(null);

    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    const getIndexBySectorId = (sectorId: string) => {
        const idx = sectors.findIndex((s) => s.id === sectorId);
        return idx >= 0 ? idx : 0;
    };

    const getSectorById = (sectorId: string) =>
        sectors.find((s) => s.id === sectorId) || sectors[0];

    const spin = async () => {
        if (!token) {
            setError('Открой игру через Telegram.');
            return;
        }
        if (spinning) return;

        setError('');
        setResult(null);
        setWinningId(null);
        setSpinning(true);

        let payload: SpinResponse;

        try {
            const res = await apiFetch('/roulette/spin', token, {
                method: 'POST',
                body: JSON.stringify({}),
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error((json as any)?.message || 'Spin failed');
            payload = json as SpinResponse;
        } catch (e: any) {
            setSpinning(false);
            setError(e?.message || 'Ошибка спина');
            return;
        }

        const targetIndex = getIndexBySectorId(payload.sectorId);

        // pointer at top (0deg), stop in center of sector
        const spins = 6;
        const centerOffset = sectorAngle / 2;
        const targetAngle = spins * 360 + (360 - (targetIndex * sectorAngle + centerOffset));

        const start = performance.now();
        const duration = 3200;
        const startAngle = angle;
        const delta = targetAngle;

        const animate = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = easeOutCubic(t);
            setAngle(startAngle + delta * eased);

            if (t < 1) {
                rafRef.current = requestAnimationFrame(animate);
            } else {
                setSpinning(false);
                setResult(payload);
                setWinningId(payload.sectorId);
                onReward?.(payload);
            }
        };

        rafRef.current = requestAnimationFrame(animate);
    };

    const winSector = result ? getSectorById(result.sectorId) : null;

    return (
        <div className="rw-overlay" onClick={onClose}>
            <div className="rw-sheet" onClick={(e) => e.stopPropagation()}>
                {/* top row (balance + close) */}
                <div className="rw-sheet-top">
                    <div className="rw-balance">
                        <span className="rw-balance-coin">🪙</span>
                        <b>{coins ?? '—'}</b>
                    </div>

                    <button className="rw-close" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>

                {!!error && <div className="rw-error">{error}</div>}

                {/* arc wheel area */}
                <div className="rw-arc">
                    <div className="rw-pointer" aria-hidden="true" />

                    <div className="rw-wheel-clip">
                        <div
                            className="rw-wheel"
                            style={{
                                transform: `rotate(${angle}deg)`,
                                ['--sa' as any]: `${sectorAngle}deg`,
                            }}
                        >
                            {sectors.map((s, i) => {
                                const rot = i * sectorAngle;
                                return (
                                    <div
                                        key={s.id}
                                        className={`rw-sector ${winningId === s.id ? 'is-winning' : ''}`}
                                        style={{
                                            transform: `rotate(${rot}deg)`,
                                            ['--rot' as any]: `${rot}deg`,
                                        }}
                                    >
                                        <div
                                            className="rw-sector-inner"
                                            style={{ transform: `skewY(${90 - sectorAngle}deg)` }}
                                        />

                                        <div className="rw-sector-content">
                                            <div className="rw-sector-icon">{s.icon}</div>
                                            <div className="rw-sector-text">
                                                <div className="rw-sector-title">{s.title}</div>
                                                {s.subtitle && <div className="rw-sector-sub">{s.subtitle}</div>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="rw-bulbs" aria-hidden="true" />
                            <div className="rw-dome" aria-hidden="true" />
                            <div className="rw-center" />
                        </div>
                    </div>
                </div>

                {/* main spin button */}
                <button
                    className={`rw-spin ${spinning ? 'is-disabled' : ''}`}
                    onClick={spin}
                    disabled={spinning}
                    onMouseDown={(e) => e.preventDefault()}
                    onTouchStart={(e) => e.preventDefault()}
                >
                    <div className="rw-spin-title">{spinning ? 'ВРАЩАЕМ...' : 'ВРАЩАТЬ'}</div>
                    <div className="rw-spin-sub">
                        <span className="rw-spin-coin">🪙</span> {spinCost}
                    </div>
                </button>

                {/* bottom cards like on screenshot */}
                <div className="rw-cards">
                    <button className="rw-card" onClick={spin} disabled={spinning}>
                        <div className="rw-card-title">БАРАБАН</div>
                        <div className="rw-card-sub"><span>🪙</span> {spinCost}</div>
                    </button>

                    <button className="rw-card rw-card--pink" onClick={spin} disabled={spinning}>
                        <div className="rw-card-title">{dailyFreeText}</div>
                        <div className="rw-card-big">MEGA X10</div>
                        <div className="rw-card-sub"><span>⭐</span> {spinCost}</div>
                    </button>
                </div>

                {/* result hint */}
                {result ? (
                    <div className="rw-result">
                        🎯 Выпало: <b>{winSector?.icon} {winSector?.title}</b>
                    </div>
                ) : (
                    <div className="rw-note">
                        🎁 1 бесплатный спин в день, затем {spinCost} 🪙
                    </div>
                )}
            </div>
        </div>
    );
}
