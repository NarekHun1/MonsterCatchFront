import './match3.css';
import { useMemo, useState } from 'react';

const TYPES = ['😈', '🪙', '💎', '🔥', '🍀'];

function randomTile() {
    return TYPES[Math.floor(Math.random() * TYPES.length)];
}

function genBoard(size: number) {
    return Array.from({ length: size }, () =>
        Array.from({ length: size }, () => randomTile())
    );
}

export default function Match3Level({
                                        level,
                                        onBack,
                                    }: {
    level: number;
    onBack: () => void;
}) {
    const size = level <= 2 ? 6 : level <= 5 ? 7 : 8;
    const movesInit = Math.max(10, 22 - level);

    const initial = useMemo(() => genBoard(size), [size]);
    const [board] = useState(initial);
    const [moves] = useState(movesInit);

    return (
        <div className="match3-wrap">
            <div className="match3-topbar">
                <button className="match3-back" onClick={onBack}>⬅ Уровни</button>
                <div className="match3-title">🍬 Monster Crush · Level {level}</div>
                <div className="match3-moves">Ходы: {moves}</div>
            </div>

            <div className="match3-board" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
                {board.flatMap((row, y) =>
                    row.map((cell, x) => (
                        <div key={`${x}-${y}`} className="match3-tile">
                            {cell}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
