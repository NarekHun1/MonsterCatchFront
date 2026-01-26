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

type Pos = { x: number; y: number };

function isNeighbor(a: Pos, b: Pos) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
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
    const [board, setBoard] = useState<string[][]>(initial);
    const [moves, setMoves] = useState<number>(movesInit);
    const [selected, setSelected] = useState<Pos | null>(null);

    const swap = (a: Pos, b: Pos) => {
        setBoard((prev) => {
            const next = prev.map((r) => r.slice());
            const tmp = next[a.y][a.x];
            next[a.y][a.x] = next[b.y][b.x];
            next[b.y][b.x] = tmp;
            return next;
        });
    };

    const onTileClick = (x: number, y: number) => {
        if (moves <= 0) return;

        const cur = { x, y };

        if (!selected) {
            setSelected(cur);
            return;
        }

        // клик по той же — снять выделение
        if (selected.x === cur.x && selected.y === cur.y) {
            setSelected(null);
            return;
        }

        // если сосед — меняем местами и списываем ход
        if (isNeighbor(selected, cur)) {
            swap(selected, cur);
            setSelected(null);
            setMoves((m) => Math.max(0, m - 1));
            return;
        }

        // если не сосед — просто выбрать новую клетку
        setSelected(cur);
    };

    return (
        <div className="match3-wrap">
            <div className="match3-topbar">
                <button className="match3-back" onClick={onBack}>
                    ⬅ Уровни
                </button>
                <div className="match3-title">🍬 Monster Crush · Level {level}</div>
                <div className="match3-moves">Ходы: {moves}</div>
            </div>

            <div
                className="match3-board"
                style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
            >
                {board.flatMap((row, yy) =>
                    row.map((cell, xx) => {
                        const active = selected?.x === xx && selected?.y === yy;
                        return (
                            <button
                                key={`${xx}-${yy}`}
                                className={`match3-tile ${active ? 'match3-tile--selected' : ''}`}
                                onClick={() => onTileClick(xx, yy)}
                            >
                                {cell}
                            </button>
                        );
                    })
                )}
            </div>

            {moves <= 0 && (
                <div className="match3-over">
                    <div className="match3-over-card">
                        <div className="match3-over-title">Ходы закончились 😅</div>
                        <button className="match3-back" onClick={onBack}>
                            ⬅ К уровням
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
