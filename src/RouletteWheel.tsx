import { useRef, useState } from 'react';
import './RouletteWheel.css';

export type PrizeType = 'COINS' | 'TICKETS' | 'STARS' | 'NOTHING' | 'JACKPOT';

type Sector = {
    id: string;
    label: string;
    icon: string;
};

type RouletteWheelProps = {
    token: string | null;
    onClose: () => void;
    onReward: () => void;
};

const SECTORS: Sector[] = [
    { id: 'duck', label: 'UTKA', icon: '🦆' },
    { id: 'yin10', label: '10', icon: '🌀' },
    { id: 'coins2500', label: '2500', icon: '🪙' },
    { id: 'yin100', label: '100', icon: '🌀' },
    { id: 'ticket1', label: '1', icon: '🎟️' },
];

export  function RouletteWheel({
                                          onClose,
                                          onReward,
                                      }: RouletteWheelProps) {
    const wheelRef = useRef<HTMLDivElement>(null);
    const [spinning, setSpinning] = useState(false);

    const spin = async () => {
        if (spinning) return;
        setSpinning(true);

        // 🔹 позже тут будет ответ сервера
        const randomIndex = Math.floor(Math.random() * SECTORS.length);
        const sectorAngle = 360 / SECTORS.length;
        const deg =
            360 * 6 +
            (SECTORS.length - randomIndex) * sectorAngle -
            sectorAngle / 2;

        if (wheelRef.current) {
            wheelRef.current.style.transition =
                'transform 4s cubic-bezier(.1,.7,.1,1)';
            wheelRef.current.style.transform = `rotate(${deg}deg)`;
        }

        setTimeout(() => {
            setSpinning(false);
            onReward(); // 🔔 награда получена
        }, 4000);
    };

    return (
        <div className="roulette-overlay">
            <div className="roulette-modal">
                <button className="roulette-close" onClick={onClose}>
                    ✕
                </button>

                <div className="roulette-wrapper">
                    <div className="pointer" />

                    <div className="wheel" ref={wheelRef}>
                        {SECTORS.map((s, i) => (
                            <div
                                key={s.id}
                                className="sector"
                                style={{
                                    transform: `rotate(${(360 / SECTORS.length) * i}deg)`,
                                }}
                            >
                                <div className="sector-content">
                                    <div className="icon">{s.icon}</div>
                                    <div className="label">{s.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <button className="spin-btn" onClick={spin} disabled={spinning}>
                    {spinning ? 'КРУТИТСЯ...' : 'ВРАЩАТЬ ⭐ 100'}
                </button>
            </div>
        </div>
    );
}
