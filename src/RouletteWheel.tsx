import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from './api';
import './RouletteWheel.css';

type PrizeType = 'COINS' | 'TICKETS' | 'STARS' | 'NOTHING' | 'JACKPOT';

type Sector = {
    id: string;
    type: PrizeType;
    label: string;        // "+10", "2500", "JACKPOT", "0"
    iconSrc?: string;     // может быть пустым
    variant?: 'coin' | 'ticket' | 'star' | 'jackpot' | 'zero';
};

type SpinResponse = {
    sectorId: string;
    label?: string;
    type?: PrizeType;
    amount?: number;
    costCoins?: number;
    freeTodayUsed?: boolean;
};

function easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
}

function useBodyScrollLock(enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;

        const body = document.body;
        const html = document.documentElement;
        const scrollY = window.scrollY || 0;

        const prev = {
            pos: body.style.position,
            top: body.style.top,
            left: body.style.left,
            right: body.style.right,
            width: body.style.width,
            overflow: body.style.overflow,
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
            body.style.position = prev.pos;
            body.style.top = prev.top;
            body.style.left = prev.left;
            body.style.right = prev.right;
            body.style.width = prev.width;
            body.style.overflow = prev.overflow;
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
                              }: {
    token: string | null;
    onClose: () => void;
    onReward?: (reward: SpinResponse) => void;
    coins?: number;
}) {
    useBodyScrollLock(true);

    // Telegram BackButton -> close
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

    const sectors = useMemo<Sector[]>(
        () => [
            { id: 'ticket_1', type: 'TICKETS', label: '+1', iconSrc: '/ui/ticket.png', variant: 'ticket' },
            { id: 'coins_10', type: 'COINS', label: '10', iconSrc: '/ui/coin.png', variant: 'coin' },
            { id: 'coins_25', type: 'COINS', label: '25', iconSrc: '/ui/coin.png', variant: 'coin' },
            { id: 'stars_5', type: 'STARS', label: '5', iconSrc: '/ui/star.png', variant: 'star' },
            { id: 'ticket_3', type: 'TICKETS', label: '+3', iconSrc: '/ui/ticket.png', variant: 'ticket' },
            { id: 'stars_10', type: 'STARS', label: '10', iconSrc: '/ui/star.png', variant: 'star' },
            { id: 'jackpot', type: 'JACKPOT', label: 'JACKPOT', iconSrc: '/ui/jackpot.png', variant: 'jackpot' },
            { id: 'nothing', type: 'NOTHING', label: '0', iconSrc: '/ui/zero.png', variant: 'zero' },
        ],
        [],
    );

    const sectorAngle = 360 / sectors.length;

    const [angle, setAngle] = useState(0);
    const [spinning, setSpinning] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<SpinResponse | null>(null);
    const [winningId, setWinningId] = useState<string | null>(null);

    const [freeAvailable, setFreeAvailable] = useState(true);
    const spinCost = freeAvailable ? 0 : 10;

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

        if (payload.freeTodayUsed === true || payload.costCoins === 10) setFreeAvailable(false);
        if (payload.costCoins === 0) setFreeAvailable(false);

        const targetIndex = getIndexBySectorId(payload.sectorId);

        const spins = 6;
        const centerOffset = sectorAngle / 2;
        const targetAngle = spins * 360 + (360 - (targetIndex * sectorAngle + centerOffset));

        const start = performance.now();
        const duration = 3300;
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
        <div className="rw2-overlay" onClick={onClose}>
            <div className="rw2-sheet" onClick={(e) => e.stopPropagation()}>
                <div className="rw2-top">
                    <div className="rw2-balance">
                        <img className="rw2-balance-icon" src="/ui/coin.png" alt="" />
                        <b>{coins ?? '—'}</b>
                    </div>

                    <button className="rw2-close" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>

                {!!error && <div className="rw2-error">{error}</div>}

                <div className="rw2-arc">
                    <div className="rw2-pointer" />

                    <div className="rw2-clip">
                        <div className="rw2-wheel-pos">
                            <div
                                className="rw2-wheel"
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
                                            className={`rw2-sector ${s.variant ?? ''} ${winningId === s.id ? 'is-winning' : ''}`}
                                            style={{ transform: `rotate(${rot}deg)`, ['--rot' as any]: `${rot}deg` }}
                                        >
                                            <div
                                                className="rw2-sector-inner"
                                                style={{ transform: `skewY(${90 - sectorAngle}deg)` }}
                                            />

                                            {/* ✅ как на фото: иконка + цифра по центру сектора */}
                                            <div className="rw2-sector-content">
                                                {s.iconSrc ? (
                                                    <img className="rw2-sector-icon" src={s.iconSrc} alt="" />
                                                ) : (
                                                    <div className="rw2-sector-icon rw2-sector-icon--ph" />
                                                )}
                                                <div className="rw2-sector-label">{s.label}</div>
                                            </div>
                                        </div>
                                    );
                                })}

                                <div className="rw2-bulbs" />
                                <div className="rw2-dome" />
                                <div className="rw2-center" />
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    className={`rw2-spin ${spinning ? 'is-disabled' : ''}`}
                    onClick={spin}
                    disabled={spinning}
                    onMouseDown={(e) => e.preventDefault()}
                    onTouchStart={(e) => e.preventDefault()}
                >
                    <div className="rw2-spin-title">{spinning ? 'КРУТИМ...' : 'ВРАЩАТЬ'}</div>

                    <div className="rw2-spin-sub">
                        {spinCost === 0 ? (
                            <span className="rw2-free">БЕСПЛАТНО</span>
                        ) : (
                            <>
                                <img className="rw2-spin-coin" src="/ui/coin.png" alt="" />
                                <span>{spinCost}</span>
                            </>
                        )}
                    </div>
                </button>

                {result ? (
                    <div className="rw2-result">
                        🎯 Выпало: <b>{winSector?.label}</b>
                    </div>
                ) : (
                    <div className="rw2-note">
                        🎁 1 бесплатный спин в день, затем 10 🪙 за спин
                    </div>
                )}
            </div>
        </div>
    );
}
