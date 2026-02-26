import { useEffect, useMemo, useRef, useState } from 'react';
import './RouletteWheel.css';
import { apiFetch } from './api';
import spinSfx from './assets/sfx/spin.wav';

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
    onReward: (r: SpinResponse) => void;
};

type Sector = {
    id: string;
    label: string;
    icon: string;
    variant?: 'coin' | 'ticket' | 'star' | 'jackpot' | 'zero';
};

// ⚠️ id должны совпадать с backend ROULETTE_SECTORS.id
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
    const m = deg % 360;
    return m < 0 ? m + 360 : m;
}

export function RouletteWheel({ token, onClose, onReward }: RouletteWheelProps) {
    const wheelRef = useRef<HTMLDivElement>(null);

    const [spinning, setSpinning] = useState(false);
    const [error, setError] = useState<string>('');

    const [result, setResult] = useState<SpinResponse | null>(null);
    const [showResult, setShowResult] = useState(false);

    const spinAudioRef = useRef<HTMLAudioElement | null>(null);
    const rotationRef = useRef<number>(0);

    const sectorCount = SECTORS.length;
    const sectorAngle = 360 / sectorCount;

    const sectorIndexById = useMemo(() => {
        const map = new Map<string, number>();
        SECTORS.forEach((s, i) => map.set(s.id, i));
        return map;
    }, []);

    const hintText = useMemo(() => '1 раз в день бесплатно, потом 10 🪙', []);

    // ✅ LOCK BACKGROUND SCROLL (iOS Telegram WebView fix)
    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        const prevTouch = (document.body.style as any).touchAction;

        document.body.style.overflow = 'hidden';
        (document.body.style as any).touchAction = 'none';

        return () => {
            document.body.style.overflow = prevOverflow;
            (document.body.style as any).touchAction = prevTouch;
        };
    }, []);

    const ensureSpinAudio = () => {
        if (!spinAudioRef.current) {
            const a = new Audio(spinSfx);
            a.preload = 'auto';
            a.loop = true;
            a.volume = 0.6;
            spinAudioRef.current = a;
        }
    };

    const startSpinSound = async () => {
        ensureSpinAudio();
        const a = spinAudioRef.current!;
        try {
            a.currentTime = 0;
            await a.play();
        } catch {}
    };

    const stopSpinSound = () => {
        const a = spinAudioRef.current;
        if (!a) return;
        try {
            a.pause();
            a.currentTime = 0;
        } catch {}
    };

    const showAlert = (msg: string) => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.showAlert) tg.showAlert(msg);
    };

    const spinToIndex = (targetIndex: number) => {
        // Стрелка сверху. Нужен центр сектора под стрелку.
        const targetCenterDeg = targetIndex * sectorAngle + sectorAngle / 2;
        const current = clampRotation(rotationRef.current);

        const extraSpins = 6;
        const desired = 360 * extraSpins + (360 - targetCenterDeg);
        const finalDeg = rotationRef.current + (desired - current);

        if (wheelRef.current) {
            wheelRef.current.style.transition = 'transform 4.2s cubic-bezier(.12,.74,.12,1)';
            wheelRef.current.style.transform = `rotate(${finalDeg}deg)`;
        }

        rotationRef.current = finalDeg;

        // нормализуем
        window.setTimeout(() => {
            const normalized = clampRotation(rotationRef.current);
            rotationRef.current = normalized;

            if (wheelRef.current) {
                wheelRef.current.style.transition = 'none';
                wheelRef.current.style.transform = `rotate(${normalized}deg)`;
            }
        }, 4300);
    };

    const openResult = (data: SpinResponse) => {
        setResult(data);
        setShowResult(true);
    };

    const closeResultOnly = () => setShowResult(false);

    const closeToMenu = () => {
        // отдельный “В меню” — просто закрываем рулетку
        onClose();
    };

    const handleSpin = async () => {
        if (spinning) return;

        setError('');
        setResult(null);
        setShowResult(false);

        if (!token) {
            const msg = 'Нет токена. Открой игру через Telegram.';
            setError(msg);
            showAlert(msg);
            return;
        }

        setSpinning(true);
        startSpinSound();

        try {
            // сервер решает: free/paid, списание и приз
            const res = await apiFetch('/roulette/spin', token, { method: 'POST' });
            const data: SpinResponse = await res.json().catch(() => ({} as any));

            if (!res.ok) {
                const msg = (data as any)?.message || 'Ошибка спина';
                setError(msg);
                showAlert(msg);

                stopSpinSound();
                setSpinning(false);
                return;
            }

            const idx = sectorIndexById.get(data.sectorId);

            if (idx === undefined) {
                console.warn('[ROULETTE] Unknown sectorId from backend:', data.sectorId);
                console.warn('[ROULETTE] Front SECTORS ids:', SECTORS.map((s) => s.id));

                const randomIdx = Math.floor(Math.random() * SECTORS.length);
                spinToIndex(randomIdx);

                window.setTimeout(() => {
                    stopSpinSound();
                    openResult(data);
                    onReward(data);
                    flyToHeader(data.type, data.amount);
                    setSpinning(false);
                }, 4300);

                return;
            }

            // запускаем вращение
            spinToIndex(idx);

            // по окончанию — открываем отдельный экран результата
            window.setTimeout(() => {
                stopSpinSound();
                openResult(data);
                onReward(data);
                flyToHeader(data.type, data.amount);
                setSpinning(false);
            }, 4300);
        } catch (e: any) {
            console.error(e);
            const msg = e?.message || 'Ошибка сети';
            setError(msg);
            showAlert(msg);

            stopSpinSound();
            setSpinning(false);
        }
    };

    // иконка для результата
    const resultIcon = useMemo(() => {
        if (!result) return '🎁';
        if (result.type === 'COINS') return '🪙';
        if (result.type === 'STARS') return '⭐';
        if (result.type === 'TICKETS') return '🎟️';
        if (result.type === 'JACKPOT') return '💎';
        return '⭕';
    }, [result]);

    return (
        <div className="roulette-overlay" onClick={onClose} role="dialog" aria-modal="true">
            <div className="roulette-modal" onClick={(e) => e.stopPropagation()}>
                {/* TOP BAR */}
                <div className="roulette-topbar">
                    <div className="rb-left">
                        <button className="rb-btn rb-back" onClick={onClose} aria-label="Back">
                            ←
                        </button>

                        <div className="rb-title">
                            <b>Рулетка удачи</b>
                            <span>{hintText}</span>
                        </div>
                    </div>

                    <div className="rb-actions">
                        <button className="rb-btn rb-icon" onClick={onClose} aria-label="Close">
                            ✕
                        </button>
                    </div>
                </div>

                {/* BODY */}
                <div className="roulette-body">
                    <div className="roulette-badge">Lucky Spin</div>

                    <div className="roulette-hero">
                        <h2>Поймай свой приз 🎁</h2>
                        <p>Крути колесо и забирай бонусы. Бесплатно раз в день — дальше за монеты.</p>
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
                </div>

                {/* FOOTER (CTA always visible) */}
                <div className="roulette-footer">
                    <div className="rf-actions">
                        <button className="spin-btn" onClick={handleSpin} disabled={spinning}>
                            {spinning ? 'КРУТИТСЯ…' : 'КРУТИТЬ'}
                        </button>

                        <button className="menu-btn" onClick={onClose} disabled={spinning}>
                            В МЕНЮ
                        </button>
                    </div>

                    <div className="spin-meta">
                        <span>Выход: ← / ✕ / В МЕНЮ</span>
                        <span className="spin-cost">⭐ / 🪙</span>
                    </div>
                </div>

                {/* RESULT SCREEN (separate overlay) */}
                {showResult && result && (
                    <div className="roulette-resultOverlay" onClick={closeResultOnly}>
                        <div className="roulette-resultModal" onClick={(e) => e.stopPropagation()}>
                            <div className="rso-head">
                                <div className="rso-badge">RESULT</div>
                                <button className="rso-x" onClick={closeResultOnly} aria-label="Close result">
                                    ✕
                                </button>
                            </div>

                            <div className="rso-icon">{resultIcon}</div>
                            <div className="rso-title">Твой приз</div>
                            <div className="rso-sub">
                                {result.type === 'NOTHING' ? 'Повезёт в следующий раз 😈' : 'Поздравляем! Забирай бонус ✅'}
                            </div>

                            <div className="rso-card">
                                <div className="rso-row">
                                    <span>Выпало</span>
                                    <b>{result.label}</b>
                                </div>

                                <div className="rso-row">
                                    <span>Тип</span>
                                    <b>{result.type}</b>
                                </div>

                                {typeof result.amount === 'number' && (
                                    <div className="rso-row">
                                        <span>Кол-во</span>
                                        <b>{result.amount}</b>
                                    </div>
                                )}

                                <div className="rso-row">
                                    <span>Цена</span>
                                    <b>{result.costCoins} 🪙</b>
                                </div>

                                <div className="rso-small">
                                    {result.freeTodayUsed
                                        ? 'Бесплатный спин сегодня уже использован.'
                                        : 'Это был бесплатный спин сегодня ✅'}
                                </div>
                            </div>

                            <div className="rso-actions">
                                <button className="rso-ok" onClick={closeResultOnly}>
                                    OK (ещё крутить)
                                </button>
                                <button className="rso-menu" onClick={closeToMenu}>
                                    В МЕНЮ
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    function flyToHeader(type: PrizeType, amount?: number) {
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
            { duration: 700, easing: 'cubic-bezier(.2,.9,.2,1)' }
        ).onfinish = () => el.remove();
    }
}

export default RouletteWheel;