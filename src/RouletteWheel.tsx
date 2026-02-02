import { useMemo, useRef, useState } from 'react';
import './RouletteWheel.css';
import { apiFetch } from './api';

type PrizeType = 'COINS' | 'TICKETS' | 'STARS' | 'NOTHING' | 'JACKPOT';

type SpinResponse = {
    sectorId: string;
    label: string;
    type: PrizeType;
    amount?: number;
    costCoins: number;
    freeTodayUsed: boolean;
};

export type RouletteWheelProps = {
    token: string | null;
    onClose: () => void;
    onReward: (r: SpinResponse) => void;};

type Sector = {
    id: string;      // ⚠️ ДОЛЖЕН совпадать с ROULETTE_SECTORS.id на backend
    label: string;   // текст на секторе
    icon: string;    // можно заменить на <img/>
    variant?: 'coin' | 'ticket' | 'star' | 'jackpot' | 'zero';
};

// ⚠️ ОБЯЗАТЕЛЬНО подгони id под твой backend roulette.config
const SECTORS: Sector[] = [
    { id: 'ticket_1', label: '+1', icon: '🎟️', variant: 'ticket' },
    { id: 'ticket_3', label: '+3', icon: '🎟️', variant: 'ticket' },
    { id: 'coins_10', label: '+10', icon: '🪙', variant: 'coin' },
    { id: 'coins_25', label: '+25', icon: '🪙', variant: 'coin' },
    { id: 'stars_5', label: '+5', icon: '⭐', variant: 'star' },
    { id: 'stars_10', label: '+10', icon: '⭐', variant: 'star' },
    { id: 'nothing', label: '0', icon: '⭕', variant: 'zero' },
    { id: 'jackpot', label: 'JACKPOT', icon: '💎', variant: 'jackpot' },
];

function clampRotation(deg: number) {
    // держим число небольшим
    const m = deg % 360;
    return m < 0 ? m + 360 : m;
}

export function RouletteWheel({ token, onClose, onReward }: RouletteWheelProps) {
    const wheelRef = useRef<HTMLDivElement>(null);

    const [spinning, setSpinning] = useState(false);
    const [error, setError] = useState<string>('');
    const [result, setResult] = useState<SpinResponse | null>(null);

    // текущий “остаточный” угол, чтобы не было дерганий между спинами
    const rotationRef = useRef<number>(0);

    const sectorCount = SECTORS.length;
    const sectorAngle = 360 / sectorCount;

    const sectorIndexById = useMemo(() => {
        const map = new Map<string, number>();
        SECTORS.forEach((s, i) => map.set(s.id, i));
        return map;
    }, []);

    const showAlert = (msg: string) => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.showAlert) tg.showAlert(msg);
    };

    const spinToIndex = (targetIndex: number) => {
        // Стрелка сверху. Нам надо центр сектора под стрелку.
        // Секторы рисуем от 0deg вправо, а стрелка сверху => корректируем.
        // Формула: чтобы сектор targetIndex оказался сверху по центру.
        const targetCenterDeg = targetIndex * sectorAngle + sectorAngle / 2;

        // текущий угол (остаток)
        const current = clampRotation(rotationRef.current);

        // хотим сделать много оборотов + попасть в target
        const extraSpins = 6; // сколько полных кругов
        const desired = 360 * extraSpins + (360 - targetCenterDeg);

        // добавим так, чтобы движение было “вперед” от текущего положения
        const finalDeg = rotationRef.current + (desired - current);

        if (wheelRef.current) {
            wheelRef.current.style.transition = 'transform 4.2s cubic-bezier(.12,.74,.12,1)';
            wheelRef.current.style.transform = `rotate(${finalDeg}deg)`;
        }

        rotationRef.current = finalDeg;

        // после анимации нормализуем, чтобы значения не росли бесконечно
        window.setTimeout(() => {
            const normalized = clampRotation(rotationRef.current);
            rotationRef.current = normalized;

            if (wheelRef.current) {
                wheelRef.current.style.transition = 'none';
                wheelRef.current.style.transform = `rotate(${normalized}deg)`;
            }
        }, 4300);
    };

    const handleSpin = async () => {
        if (spinning) return;

        setError('');
        setResult(null);

        if (!token) {
            setError('Нет токена. Открой игру через Telegram.');
            showAlert('Нет токена. Открой игру через Telegram.');
            return;
        }

        setSpinning(true);

        try {
            // 1) просим сервер сделать спин (он решает: free/paid, списание и награда)
            const res = await apiFetch('/roulette/spin', token, { method: 'POST' });
            const data: SpinResponse = await res.json().catch(() => ({} as any));

            if (!res.ok) {
                const msg = (data as any)?.message || 'Ошибка спина';
                setError(msg);

                // если монет не хватает — красиво покажем
                showAlert(msg);
                setSpinning(false);
                return;
            }

            // 2) найти сектор по sectorId
            const idx = sectorIndexById.get(data.sectorId);

            if (idx === undefined) {
                console.warn('[ROULETTE] Unknown sectorId from backend:', data.sectorId);
                console.warn('[ROULETTE] Front SECTORS ids:', SECTORS.map(s => s.id));

                // ✅ fallback: чтобы не "зависало" — крутим на случайный сектор
                const randomIdx = Math.floor(Math.random() * SECTORS.length);
                spinToIndex(randomIdx);

                // после анимации всё равно показываем настоящий результат с бэка
                window.setTimeout(() => {
                    setResult(data);
                    onReward(data);
                    flyToHeader(data.type, data.amount);
                    setSpinning(false);
                }, 4300);

                return; // важно, чтобы дальше код не шел
            }

            // 3) крутить и остановить на нужном секторе
            // запускаем анимацию сразу после ответа сервера (честно и синхронно)
            spinToIndex(idx);

            // 4) когда барабан остановился — показать результат + дернуть onReward()
            window.setTimeout(() => {
                setResult(data);
                onReward(data);
                flyToHeader(data.type, data.amount);
                setSpinning(false);
            }, 4300);
        } catch (e: any) {
            console.error(e);
            setError(e?.message || 'Ошибка сети');
            showAlert(e?.message || 'Ошибка сети');
            setSpinning(false);
        }
    };

    const hintText = useMemo(() => {
        // пока нет результата — подсказка про стоимость
        return '1 раз в день бесплатно, потом 10 🪙';
    }, []);

    return (
        <div className="roulette-overlay" onClick={onClose}>
            <div className="roulette-modal" onClick={(e) => e.stopPropagation()}>
                <button className="roulette-close" onClick={onClose} aria-label="Close">
                    ✕
                </button>

                <div className="roulette-title">
                    <div className="rt-badge">LUCKY SPIN</div>
                    <div className="rt-main">Рулетка удачи</div>
                    <div className="rt-sub">{hintText}</div>
                </div>

                {error && <div className="roulette-error">{error}</div>}

                <div className="roulette-stage">
                    <div className="pointer" />
                    <div className="wheel" ref={wheelRef}>
                        {SECTORS.map((s, i) => (
                            <div
                                key={s.id}
                                className={`sector sector--${s.variant || 'coin'}`}
                                style={{
                                    transform: `rotate(${sectorAngle * i}deg)`,
                                    ['--i' as any]: i,
                                    ['--count' as any]: SECTORS.length,
                                }}
                            >
                                <div className="sector-content">
                                    <div className="sector-icon">{s.icon}</div>
                                    <div className="sector-label">{s.label}</div>
                                </div>
                            </div>
                        ))}

                        <div className="wheel-center">
                            <div className="wc-ring" />
                            <div className="wc-dot" />
                        </div>
                    </div>
                </div>

                <button className="spin-btn" onClick={handleSpin} disabled={spinning}>
                    {spinning ? 'КРУТИТСЯ…' : 'КРУТИТЬ'}
                    <span className="spin-cost">⭐ / 🪙</span>
                </button>

                {result && (
                    <div className="roulette-result">
                        <div className="rr-title">🎁 Твой приз</div>
                        <div className="rr-card">
                            <div className="rr-line">
                                <span className="rr-muted">Выпало:</span>
                                <b>{result.label}</b>
                            </div>
                            <div className="rr-line">
                                <span className="rr-muted">Тип:</span>
                                <b>{result.type}</b>
                            </div>

                            {typeof result.amount === 'number' && (
                                <div className="rr-line">
                                    <span className="rr-muted">Кол-во:</span>
                                    <b>{result.amount}</b>
                                </div>
                            )}

                            <div className="rr-line">
                                <span className="rr-muted">Цена:</span>
                                <b>{result.costCoins} 🪙</b>
                            </div>

                            <div className="rr-small">
                                {result.freeTodayUsed
                                    ? 'Бесплатный спин сегодня уже использован.'
                                    : 'Это был бесплатный спин сегодня ✅'}
                            </div>
                        </div>

                        <button className="rr-ok" onClick={onClose}>
                            Ок
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
    function flyToHeader(type: PrizeType, amount?: number) {
        // ❌ Ничего не выиграли — ничего не летит
        if (type === 'NOTHING' || !amount || amount <= 0) return;

        const icon =
            type === 'COINS' || type === 'JACKPOT'
                ? '🪙'
                : type === 'STARS'
                    ? '⭐'
                    : type === 'TICKETS'
                        ? '🎟️'
                        : '🎁';

        const target =
            type === 'COINS' || type === 'JACKPOT'
                ? document.querySelector('.user-pill--coins')
                : type === 'STARS'
                    ? document.querySelector('.user-pill--stars')
                    : type === 'TICKETS'
                        ? document.querySelector('.user-pill--tickets')
                        : null;

        if (!target) return;

        const startEl = document.querySelector('.roulette-stage');
        if (!startEl) return;

        const start = startEl.getBoundingClientRect();
        const end = (target as HTMLElement).getBoundingClientRect();

        const el = document.createElement('div');
        el.className = 'reward-fly';
        el.textContent = icon;
        document.body.appendChild(el);

        const x1 = start.left + start.width / 2;
        const y1 = start.top + start.height / 2;
        const x2 = end.left + end.width / 2;
        const y2 = end.top + end.height / 2;

        el.style.left = `${x1}px`;
        el.style.top = `${y1}px`;

        el.animate(
            [
                { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
                {
                    transform: `translate(${x2 - x1}px, ${y2 - y1}px) scale(0.35)`,
                    opacity: 0.95,
                },
            ],
            {
                duration: 700,
                easing: 'cubic-bezier(.2,.9,.2,1)',
            }
        ).onfinish = () => {
            el.remove();
        };
    }
}

export default RouletteWheel;
