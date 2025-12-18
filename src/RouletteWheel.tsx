import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from './api';
import './RouletteWheel.css';

type PrizeType = 'COINS' | 'TICKETS' | 'STARS' | 'NOTHING' | 'JACKPOT';

type Sector = {
    id: string;
    label: string;
    // просто для UI (порядок фиксируем)
};

type SpinResponse = {
    sectorId: string;   // id сектора (должен быть один из sectors)
    label?: string;     // optional (можно вернуть с бэка)
    type?: PrizeType;   // optional
    amount?: number;    // optional
};

const DEFAULT_SECTORS: Sector[] = [
    { id: 'ticket_1', label: '🎟 +1' },
    { id: 'coins_10', label: '🪙 +10' },
    { id: 'coins_25', label: '🪙 +25' },
    { id: 'stars_5', label: '⭐ +5' },
    { id: 'ticket_3', label: '🎟 +3' },
    { id: 'stars_10', label: '⭐ +10' },
    { id: 'jackpot', label: '💥 JACKPOT' },
    { id: 'nothing', label: '❌' },
];

function easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
}

export function RouletteWheel({
                                  token,
                                  onClose,
                                  onReward, // чтобы обновить баланс/тикеты в App при желании
                              }: {
    token: string | null;
    onClose: () => void;
    onReward?: (reward: SpinResponse) => void;
}) {
    const sectors = useMemo(() => DEFAULT_SECTORS, []);
    const sectorAngle = 360 / sectors.length;

    const [angle, setAngle] = useState(0);           // текущий угол (deg)
    const [spinning, setSpinning] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<SpinResponse | null>(null);
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

    const spin = async () => {
        if (!token) {
            setError('Нужно открыть игру через Telegram (нет токена).');
            return;
        }
        if (spinning) return;

        setError('');
        setResult(null);
        setSpinning(true);

        let payload: SpinResponse;

        // ✅ 1) спрашиваем бэк
        try {
            const res = await apiFetch('/roulette/spin', token, {
                method: 'POST',
                body: JSON.stringify({}),
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.message || 'Spin failed');

            payload = json as SpinResponse;
        } catch (e: any) {
            // ✅ 2) если бэка ещё нет — fallback чтобы UI работал
            const fallback = sectors[Math.floor(Math.random() * sectors.length)];
            payload = { sectorId: fallback.id, label: fallback.label };
        }

        const targetIndex = getIndexBySectorId(payload.sectorId);

        // хотим остановиться так, чтобы СЕРЕДИНА сектора пришлась на стрелку сверху
        // стрелка смотрит в 0deg (верх). wheel вращается, поэтому:
        const spins = 6; // красивое количество оборотов
        const centerOffset = sectorAngle / 2;

        // targetIndex=0 должен стать "вверх" => угол = 360 - centerOffset
        const targetAngle =
            spins * 360 +
            (360 - (targetIndex * sectorAngle + centerOffset));

        // делаем анимацию от текущего угла к targetAngle + текущая база
        const start = performance.now();
        const duration = 3600; // ms
        const startAngle = angle;
        const delta = targetAngle;

        const animate = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = easeOutCubic(t);
            const next = startAngle + delta * eased;
            setAngle(next);

            if (t < 1) {
                rafRef.current = requestAnimationFrame(animate);
            } else {
                setSpinning(false);
                setResult(payload);
                onReward?.(payload);
            }
        };

        rafRef.current = requestAnimationFrame(animate);
    };

    return (
        <div className="roulette-overlay" onClick={onClose}>
            <div className="roulette-modal" onClick={(e) => e.stopPropagation()}>
                <div className="roulette-top">
                    <div>
                        <div className="roulette-title">🎰 Рулетка удачи</div>
                        <div className="roulette-sub">Крути и выигрывай 💰</div>
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
                        style={{ transform: `rotate(${angle}deg)` }}
                    >
                        {sectors.map((s, i) => (
                            <div
                                key={s.id}
                                className="roulette-sector"
                                style={{
                                    transform: `rotate(${i * sectorAngle}deg)`,
                                }}
                            >
                                <div
                                    className="roulette-sector-inner"
                                    style={{
                                        transform: `skewY(${90 - sectorAngle}deg)`,
                                    }}
                                >
                                    <div className="roulette-label">{s.label}</div>
                                </div>
                            </div>
                        ))}
                        <div className="roulette-center" />
                    </div>
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
                        <div className="roulette-result">
                            🎉 Выпало: <b>{result.label || sectors[getIndexBySectorId(result.sectorId)].label}</b>
                        </div>
                    )}
                    <div className="roulette-note">
                        🎁 Приз определяется случайно.
                        Шансы и награды настраиваются сервером.
                    </div>
                </div>
            </div>
        </div>
    );
}
