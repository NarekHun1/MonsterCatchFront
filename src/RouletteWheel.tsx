import { useRef, useState } from 'react';
import './RouletteWheel.css';

type Sector = {
    id: string;
    label: string;
    icon: string;
};

const SECTORS: Sector[] = [
    { id: 'duck', label: 'UTKA', icon: '🦆' },
    { id: 'yin10', label: '10', icon: '🌀' },
    { id: 'coins2500', label: '2500', icon: '🪙' },
    { id: 'yin100', label: '100', icon: '🌀' },
    { id: 'ticket', label: '1', icon: '🎟️' },
];

export default function RouletteWheel() {
    const wheelRef = useRef<HTMLDivElement>(null);
    const [spinning, setSpinning] = useState(false);

    const spin = () => {
        if (spinning) return;
        setSpinning(true);

        const deg = 360 * 6 + Math.floor(Math.random() * 360);

        if (wheelRef.current) {
            wheelRef.current.style.transition = 'transform 4s cubic-bezier(.1,.7,.1,1)';
            wheelRef.current.style.transform = `rotate(${deg}deg)`;
        }

        setTimeout(() => {
            setSpinning(false);
        }, 4000);
    };

    return (
        <div className="roulette-wrapper">
            <div className="pointer" />

            <div className="wheel" ref={wheelRef}>
                {SECTORS.map((s, i) => (
                    <div
                        key={s.id}
                        className="sector"
                        style={{ transform: `rotate(${(360 / SECTORS.length) * i}deg)` }}
                    >
                        <div className="sector-content">
                            <div className="icon">{s.icon}</div>
                            <div className="label">{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <button className="spin-btn" onClick={spin}>
                ВРАЩАТЬ <span>⭐ 100</span>
            </button>
        </div>
    );
}
