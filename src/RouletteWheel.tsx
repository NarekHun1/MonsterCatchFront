import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from './api';
import './RouletteWheel.css';

type PrizeType = 'COINS' | 'TICKETS' | 'STARS' | 'NOTHING' | 'JACKPOT';

type Sector = {
    id: string;
    title: string; // +10, JACKPOT, 0
    icon: string;  // emoji (потом можно заменить на <img/>)
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
    { id: 'ticket_1', title: '+1', icon: '🎟️' },
    { id: 'coins_10', title: '+10', icon: '🪙' },
    { id: 'coins_25', title: '+25', icon: '🪙' },
    { id: 'stars_5', title: '+5', icon: '⭐' },
    { id: 'ticket_3', title: '+3', icon: '🎟️' },
    { id: 'stars_10', title: '+10', icon: '⭐' },
    { id: 'jackpot', title: 'JACKPOT', icon: '💥' },
    { id: 'nothing', title: '0', icon: '❌' },
];

function easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
}

export function RouletteWheel({
                                  token,
                                  onClose,
                                  onReward,
                              }: {
    token: string | null;
    onClose: () => void;
    onReward?: (reward: SpinResponse) => void;
}) {
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

        // остановка по центру сектора под стрелкой (стрелка сверху, 0deg)
        const spins = 6;
        const centerOffset = sectorAngle / 2;
        const targetAngle =
            spins * 360 + (360 - (targetIndex * sectorAngle + centerOffset));

        const start = performance.now();
        const duration = 3600;
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
        <div className="roulette-overlay" onClick={onClose}>
            <div className="roulette-modal" onClick={(e) => e.stopPropagation()}>
                <div className="roulette-top">
                    <div>
                        <div className="roulette-title">🎰 Рулетка удачи</div>
                        <div className="roulette-sub">Крути и получай бонус 🎁</div>
                    </div>

                    <button className="roulette-close" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
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
                                    className={`roulette-sector ${winningId === s.id ? 'is-winning' : ''}`}
                                    style={{
                                        transform: `rotate(${rot}deg)`,
                                        ['--rot' as any]: `${rot}deg`,
                                    }}
                                >
                                    {/* клин (фон сектора) */}
                                    <div
                                        className="roulette-sector-inner"
                                        style={{ transform: `skewY(${90 - sectorAngle}deg)` }}
                                    />

                                    {/* контент сектора — отдельно, чтобы не клипалось skew */}
                                    <div className="roulette-sector-content">
                                        <div className="roulette-sector-icon">{s.icon}</div>
                                        <div className="roulette-sector-text">{s.title}</div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Real casino layers */}
                        <div className="roulette-bulbs" aria-hidden="true" />
                        <div className="roulette-dome" aria-hidden="true" />

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
                    >
                        {spinning ? 'КРУТИМ...' : 'КРУТИТЬ'}
                    </button>

                    {result && (
                        <>
                            <div className="roulette-result">
                                🎯 Остановилось на: <b>{winSector?.icon} {winSector?.title}</b>
                            </div>

                            <div className="roulette-price">
                                {result.costCoins === 0
                                    ? '✅ Сегодняшний спин был бесплатным'
                                    : result.costCoins
                                        ? `💸 Стоимость спина: ${result.costCoins} 🪙`
                                        : '🎁 1 бесплатный спин в день, затем 10 🪙 за спин'}
                            </div>
                        </>
                    )}

                    {!result && (
                        <div className="roulette-note">
                            🎁 1 бесплатный спин в день, затем 10 🪙 за спин.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
