import './match3.css';
import { useMemo, useRef, useState } from 'react';

const TYPES = ['😈', '🪙', '💎', '🔥', '🍀'];
const EMPTY = '';

function randomTile() {
    return TYPES[Math.floor(Math.random() * TYPES.length)];
}

function genBoard(size: number) {
    // генерируем без стартовых матчей
    let b = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => randomTile())
    );

    // немного почистим, чтобы старт не был с матчами
    for (let i = 0; i < 4; i++) {
        const m = findMatches(b);
        if (m.size === 0) break;
        b = clearMatches(b, m);
        b = collapse(b);
        b = refill(b);
    }
    return b;
}

type Pos = { x: number; y: number };
type Cell = string;
type Board = Cell[][];

function isNeighbor(a: Pos, b: Pos) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

function swapInBoard(board: Board, a: Pos, b: Pos): Board {
    const next = board.map((r) => r.slice());
    const tmp = next[a.y][a.x];
    next[a.y][a.x] = next[b.y][b.x];
    next[b.y][b.x] = tmp;
    return next;
}

function keyOf(x: number, y: number) {
    return `${x}:${y}`;
}

/** Находит все клетки, которые входят в линии 3+ */
function findMatches(board: Board): Set<string> {
    const size = board.length;
    const matched = new Set<string>();

    // горизонталь
    for (let y = 0; y < size; y++) {
        let runStart = 0;
        for (let x = 1; x <= size; x++) {
            const prev = board[y][x - 1];
            const cur = x < size ? board[y][x] : null;

            if (cur !== prev || prev === EMPTY) {
                const runLen = x - runStart;
                if (prev !== EMPTY && runLen >= 3) {
                    for (let k = runStart; k < x; k++) matched.add(keyOf(k, y));
                }
                runStart = x;
            }
        }
    }

    // вертикаль
    for (let x = 0; x < size; x++) {
        let runStart = 0;
        for (let y = 1; y <= size; y++) {
            const prev = board[y - 1][x];
            const cur = y < size ? board[y][x] : null;

            if (cur !== prev || prev === EMPTY) {
                const runLen = y - runStart;
                if (prev !== EMPTY && runLen >= 3) {
                    for (let k = runStart; k < y; k++) matched.add(keyOf(x, k));
                }
                runStart = y;
            }
        }
    }

    return matched;
}

function clearMatches(board: Board, matches: Set<string>): Board {
    const size = board.length;
    const next = board.map((r) => r.slice());
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (matches.has(keyOf(x, y))) next[y][x] = EMPTY;
        }
    }
    return next;
}

/** Сдвигаем вниз все не-empty в каждой колонке */
function collapse(board: Board): Board {
    const size = board.length;
    const next: Board = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => EMPTY)
    );

    for (let x = 0; x < size; x++) {
        let writeY = size - 1;
        for (let y = size - 1; y >= 0; y--) {
            const v = board[y][x];
            if (v !== EMPTY) {
                next[writeY][x] = v;
                writeY--;
            }
        }
    }
    return next;
}

function refill(board: Board): Board {
    const size = board.length;
    const next = board.map((r) => r.slice());
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (next[y][x] === EMPTY) next[y][x] = randomTile();
        }
    }
    return next;
}

function getUiForSize(size: number) {
    if (size <= 6) return { tile: 52, gap: 10, font: 26 };
    if (size === 7) return { tile: 44, gap: 8, font: 24 };
    return { tile: 38, gap: 7, font: 22 };
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
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

    const { tile, gap, font } = getUiForSize(size);

    const initial = useMemo(() => genBoard(size), [size]);
    const [board, setBoard] = useState<Board>(initial);
    const [moves, setMoves] = useState<number>(movesInit);
    const [score, setScore] = useState<number>(0);

    const [selected, setSelected] = useState<Pos | null>(null);

    // чтобы не кликали во время анимаций
    const [busy, setBusy] = useState(false);

    // подсветка удаления
    const [clearing, setClearing] = useState<Set<string>>(new Set());

    // чтобы async-цепочки не ломались при быстрых перерендерах
    const opId = useRef(0);

    const runCascade = async (startBoard: Board) => {
        opId.current += 1;
        const my = opId.current;

        let cur = startBoard;
        let chain = 0;

        while (true) {
            const matches = findMatches(cur);
            if (matches.size === 0) break;

            chain += 1;

            // подсветка исчезновения
            setClearing(new Set(matches));
            await sleep(140);
            if (opId.current !== my) return;

            // очистка + очки
            cur = clearMatches(cur, matches);
            setBoard(cur);
            setScore((s) => s + matches.size * 10 * chain);

            await sleep(120);
            if (opId.current !== my) return;

            // падение
            cur = collapse(cur);
            setBoard(cur);
            setClearing(new Set());
            await sleep(140);
            if (opId.current !== my) return;

            // новые
            cur = refill(cur);
            setBoard(cur);
            await sleep(140);
            if (opId.current !== my) return;
        }
    };

    const onTileClick = async (x: number, y: number) => {
        if (busy || moves <= 0) return;

        const cur: Pos = { x, y };

        if (!selected) {
            setSelected(cur);
            return;
        }

        if (selected.x === cur.x && selected.y === cur.y) {
            setSelected(null);
            return;
        }

        // если не сосед — просто выбрать новую
        if (!isNeighbor(selected, cur)) {
            setSelected(cur);
            return;
        }

        // сосед — пробуем swap
        setBusy(true);

        const before = board;
        const swapped = swapInBoard(before, selected, cur);
        setBoard(swapped);
        setSelected(null);

        // нашли матчи?
        const matches = findMatches(swapped);

        if (matches.size === 0) {
            // нет матчей → вернуть назад
            await sleep(140);
            setBoard(before);
            setBusy(false);
            return;
        }

        // есть матч → -ход
        setMoves((m) => Math.max(0, m - 1));

        // запускаем каскад
        await runCascade(swapped);

        setBusy(false);
    };

    return (
        <div className="match3-wrap">
            <div className="match3-topbar">
                <button className="match3-back" onClick={onBack}>
                    ⬅ Уровни
                </button>

                <div className="match3-title">🍬 Monster Crush · Level {level}</div>

                <div className="match3-moves">
                    Ходы: {moves} · Очки: {score}
                </div>
            </div>

            <div className="match3-stage">
                <div
                    className={`match3-board ${busy ? 'match3-board--busy' : ''}`}
                    style={{
                        gridTemplateColumns: `repeat(${size}, ${tile}px)`,
                        gap: `${gap}px`,
                    }}
                >
                    {board.flatMap((row, yy) =>
                        row.map((cell, xx) => {
                            const active = selected?.x === xx && selected?.y === yy;
                            const willClear = clearing.has(keyOf(xx, yy));

                            return (
                                <button
                                    key={`${xx}-${yy}`}
                                    className={[
                                        'match3-tile',
                                        active ? 'match3-tile--selected' : '',
                                        willClear ? 'match3-tile--clearing' : '',
                                    ].join(' ')}
                                    style={{ width: tile, height: tile, fontSize: font }}
                                    onClick={() => onTileClick(xx, yy)}
                                    disabled={busy}
                                >
                                    {cell}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {moves <= 0 && !busy && (
                <div className="match3-over">
                    <div className="match3-over-card">
                        <div className="match3-over-title">Ходы закончились 😅</div>
                        <div style={{ opacity: 0.9, marginBottom: 10 }}>Очки: {score}</div>
                        <button className="match3-back" onClick={onBack}>
                            ⬅ К уровням
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
