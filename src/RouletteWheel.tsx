import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from './api';
import './RouletteWheel.css';

type PrizeType = 'COINS' | 'TICKETS' | 'STARS' | 'NOTHING' | 'JACKPOT';

type Sector = {
    id: string;
    title: string;
    icon: string;
};

type SpinResponse = {
    sectorId: string;
    label?: string;
    type?: PrizeType;
    amount?: number;
    costCoins?: number;
    freeTodayUsed?: boolean;
};

const SECTORS: Sector[] = [
    { id: 'ticket_1', title: '+1', icon: '🎟️' },
    { id: 'coins_10', title: '+10', icon: '🪙' },
    { id: 'coins_25', title: '+25', icon: '🪙' },
    { id: 'stars_5', title: '+5', icon: '⭐' },
    { id: 'ticket_3', title: '+3', icon: '🎟️' },
    { id: 'stars_10', title: '+10', icon: '⭐' },
    { id: 'jackpot', title: 'JACKPOT', icon: '💥' },
    { id: 'nothing', title: '0', icon: '❌' },
];

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/* 🔒 Lock body scroll (Telegram / iOS safe) */
function useBodyScrollLock(enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;

        const body = document.body;
        const html = document.documentElement;
        const scrollY = window.scrollY;

        const prev = {
            position: body.style.position,
            top: body.style.top,
            overflow: body.style.overflow,
            htmlOverflow: html.style.overflow,
        };

        body.style.position = 'fixed';
        body.style.top = `-${scrollY}px`;
        body.style.overflow = 'hidden';
        html.style.overflow = 'hidden';

        return () => {
            body.style.position = prev.position;
            body.style.top = prev.top;
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
                                  tickets,
                                  stars,
                              }: {
    token: string | null;
    onClose: () => void;
    onReward?: (r: SpinResponse) => void;
    coins?: number;
    tickets?: number;
    stars?: number;
}) {
    useBodyScrollLock(true);

    /* 🔥 Telegram WebApp setup */
    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (!tg) return;

        tg.ready?.();
        tg.expand?.();
        tg.setHeaderColor?.('#08080e');
        tg.setBackgroundColor?.('#08080e');
        tg.disableVerticalSwipes?.();
    }, []);

    const sectors = useMemo(() => SECTORS, []);
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

    const getIndex = (id: string) =>
        Math.max(0, sectors.findIndex(s => s.id === id));

    const getSector = (id: string) =>
        sectors.find(s => s.id === id) || sectors[0];

    const spin = async () => {
        if (!token || spinning) return;

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
            const json = await res.json();
            if (!res.ok) throw new Error(json?.message || 'Spin failed');
            payload = json;
        } catch (e: any) {
            setError(e.message || 'Ошибка');
            setSpinning(false);
            return;
        }

        const index = getIndex(payload.sectorId);
        const centerOffset = sectorAngle / 2;
        const spins = 6;

        const targetAngle =
            spins * 360 + (360 - (index * sectorAngle + centerOffset));

        const start = performance.now();
        const duration = 3600;
        const startAngle = angle;

        const animate = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = easeOutCubic(t);
            setAngle(startAngle + targetAngle * eased);

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

    const winSector = result ? getSector(result.sectorId) : null;

    return (
        <div className="roulette-overlay" onClick={onClose}>
            <div className="roulette-modal" onClick={e => e.stopPropagation()}>

                {/* HUD */}
                <div className="roulette-hud">
                    <div className="roulette-hud-left">
                        <div className="roulette-pill">🪙 <b>{coins ?? '—'}</b></div>
                        <div className="roulette-pill">🎟️ <b>{tickets ?? '—'}</b></div>
                        <div className="roulette-pill">⭐ <b>{stars ?? '—'}</b></div>
                    </div>
                    <button className="roulette-hud-close" onClick={onClose}>✕</button>
                </div>

                {error && <div className="roulette-error">{error}</div>}

                <div className="roulette-stage">
                    <div className="roulette-pointer" />

                    <div
                        className="roulette-wheel"
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
                                    className={`roulette-sector ${
                                        winningId === s.id ? 'is-winning' : ''
                                    }`}
                                    style={{ transform: `rotate(${rot}deg)`, ['--rot' as any]: `${rot}deg` }}
                                >
                                    <div
                                        className="roulette-sector-inner"
                                        style={{ transform: `skewY(${90 - sectorAngle}deg)` }}
                                    />
                                    <div className="roulette-sector-content">
                                        <div className="roulette-sector-icon">{s.icon}</div>
                                        <div className="roulette-sector-text">{s.title}</div>
                                    </div>
                                </div>
                            );
                        })}

                        <div className="roulette-bulbs" />
                        <div className="roulette-dome" />
                        <div className="roulette-center" />
                    </div>

                    {result && (
                        <div className="roulette-win">
                            <div className="roulette-win-title">WIN</div>
                            <div className="roulette-win-sub">
                                {winSector?.icon} {winSector?.title}
                            </div>
                        </div>
                    )}
                </div>

                <div className="roulette-actions">
                    <button
                        className={`roulette-spin ${spinning ? 'is-disabled' : ''}`}
                        onClick={spin}
                        disabled={spinning}
                        onMouseDown={e => e.preventDefault()}
                        onTouchStart={e => e.preventDefault()}
                    >
                        {spinning ? 'КРУТИМ…' : 'КРУТИТЬ'}
                    </button>

                    {result ? (
                        <>
                            <div className="roulette-result">
                                🎯 Выпало: <b>{winSector?.icon} {winSector?.title}</b>
                            </div>
                            <div className="roulette-price">
                                {result.costCoins === 0
                                    ? '✅ Бесплатный спин сегодня'
                                    : result.costCoins
                                        ? `💸 Цена: ${result.costCoins} 🪙`
                                        : '🎁 1 бесплатный спин в день'}
                            </div>
                        </>
                    ) : (
                        <div className="roulette-note">
                            🎁 1 бесплатный спин в день, затем 10 🪙
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
