// src/Match3Level.tsx
import './match3.css';
import { useMemo, useRef, useState } from 'react';

// ✅ PNG (обычные символы)
import demonPng from './assets/tiles/monster-2.png';
import coinPng from './assets/tiles/cute.png';
import gemPng from './assets/tiles/monster-3.png';
import firePng from './assets/tiles/monster-4.png';
import cloverPng from './assets/tiles/monster.png';

const EMPTY: '' = '';

const TYPES = ['DEMON', 'COIN', 'GEM', 'FIRE', 'CLOVER'] as const;
type TileType = (typeof TYPES)[number];

type Cell = TileType | '';
type Board = Cell[][];

type Pos = { x: number; y: number };
type Booster = 'BOMB' | null;

const TILE_ICON: Record<TileType, string> = {
    DEMON: demonPng,
    COIN: coinPng,
    GEM: gemPng,
    FIRE: firePng,
    CLOVER: cloverPng,
};

function randomTile(): TileType {
    return TYPES[Math.floor(Math.random() * TYPES.length)];
}

function keyOf(x: number, y: number) {
    return `${x}:${y}`;
}

function isNeighbor(a: Pos, b: Pos) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function getUiForSize(size: number) {
    if (size <= 6) return { tile: 52, gap: 10, font: 26 };
    if (size === 7) return { tile: 44, gap: 8, font: 24 };
    return { tile: 38, gap: 7, font: 22 };
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

function swapInBoard(board: Board, a: Pos, b: Pos): Board {
    const next = board.map((r) => r.slice()) as Board;
    const tmp = next[a.y][a.x];
    next[a.y][a.x] = next[b.y][b.x];
    next[b.y][b.x] = tmp;
    return next;
}

/** генерация препятствий под уровень */
function genObstacles(level: number, size: number) {
    const ice: number[][] = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => 0)
    );

    const stone: boolean[][] = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => false)
    );

    const honey: boolean[][] = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => false)
    );

    // С 3 уровня: лёд
    if (level >= 3) {
        const count = Math.min(10, 3 + level);
        for (let i = 0; i < count; i++) {
            const x = Math.floor(Math.random() * size);
            const y = Math.floor(Math.random() * size);
            ice[y][x] = 2; // 2 слоя
        }
    }

    // С 5 уровня: камни
    if (level >= 5) {
        const count = Math.min(8, 2 + Math.floor(level / 2));
        for (let i = 0; i < count; i++) {
            const x = Math.floor(Math.random() * size);
            const y = Math.floor(Math.random() * size);
            stone[y][x] = true;
            ice[y][x] = 0;
            honey[y][x] = false;
        }
    }

    // С 7 уровня: мёд (блокеры падения)
    if (level >= 7) {
        const count = Math.min(8, 3 + Math.floor(level / 2));
        for (let i = 0; i < count; i++) {
            const x = Math.floor(Math.random() * size);
            const y = Math.floor(Math.random() * size);
            if (stone[y][x]) continue;
            honey[y][x] = true;
            ice[y][x] = Math.min(ice[y][x], 1);
        }
    }

    return { ice, stone, honey };
}

/** генерируем доску без стартовых матчей */
function genBoard(size: number) {
    const b: Board = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => randomTile())
    );

    for (let i = 0; i < 5; i++) {
        const m = findMatches(b);
        if (m.size === 0) break;
        for (const k of m) {
            const [x, y] = k.split(':').map(Number);
            b[y][x] = randomTile();
        }
    }
    return b;
}

/** очищаем матчи с учётом препятствий */
function applyMatchesWithObstacles(
    board: Board,
    matches: Set<string>,
    ice: number[][],
    honey: boolean[][],
    stone: boolean[][]
) {
    const nextBoard = board.map((r) => r.slice()) as Board;
    const nextIce = ice.map((r) => r.slice());
    const nextHoney = honey.map((r) => r.slice());

    let clearedCount = 0;
    let gemHits = 0;
    let brokeIce = 0;
    let brokeHoney = 0;

    for (const k of matches) {
        const [x, y] = k.split(':').map(Number);

        // камень не очищаем матчем
        if (stone[y][x]) continue;

        // лёд: сначала ломаем лёд
        if (nextIce[y][x] > 0) {
            nextIce[y][x] = Math.max(0, nextIce[y][x] - 1);
            brokeIce++;
            if (nextIce[y][x] > 0) continue; // лёд ещё есть — символ НЕ очищаем
        }

        // мёд: снимаем 1 ударом (и клетка очищается)
        if (nextHoney[y][x]) {
            nextHoney[y][x] = false;
            brokeHoney++;
        }

        // ✅ теперь GEM, а не '💎'
        if (nextBoard[y][x] === 'GEM') gemHits++;

        nextBoard[y][x] = EMPTY;
        clearedCount++;
    }

    return {
        board: nextBoard,
        ice: nextIce,
        honey: nextHoney,
        clearedCount,
        gemHits,
        brokeIce,
        brokeHoney,
    };
}

/** падение с учётом блокеров (stone/honey). Они стопят колонку. */
function collapseWithBlocks(board: Board, stone: boolean[][], honey: boolean[][]) {
    const size = board.length;
    const next: Board = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => EMPTY)
    );

    for (let x = 0; x < size; x++) {
        let writeY = size - 1;

        for (let y = size - 1; y >= 0; y--) {
            // блокер: камень или мёд — фиксируем как есть и "перезапускаем" колонку над ним
            if (stone[y][x] || honey[y][x]) {
                next[y][x] = board[y][x];
                writeY = y - 1;
                continue;
            }

            const v = board[y][x];
            if (v !== EMPTY) {
                while (writeY >= 0 && (stone[writeY][x] || honey[writeY][x])) {
                    next[writeY][x] = board[writeY][x];
                    writeY--;
                }
                if (writeY >= 0) {
                    next[writeY][x] = v;
                    writeY--;
                }
            }
        }
    }

    return next;
}

function refill(board: Board, stone: boolean[][], honey: boolean[][]) {
    const size = board.length;
    const next = board.map((r) => r.slice()) as Board;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (stone[y][x] || honey[y][x]) continue;
            if (next[y][x] === EMPTY) next[y][x] = randomTile();
        }
    }
    return next;
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

    // 🎯 цель: собрать GEM
    const targetGem = Math.min(20, 8 + level * 2);

    const { tile, gap, font } = getUiForSize(size);

    const initialBoard = useMemo(() => genBoard(size), [size]);
    const obstacles = useMemo(() => genObstacles(level, size), [level, size]);

    const [board, setBoard] = useState<Board>(initialBoard);
    const [ice, setIce] = useState<number[][]>(obstacles.ice);
    const [stone, setStone] = useState<boolean[][]>(obstacles.stone);
    const [honey, setHoney] = useState<boolean[][]>(obstacles.honey);

    const [moves, setMoves] = useState<number>(movesInit);
    const [score, setScore] = useState<number>(0);
    const [gems, setGems] = useState<number>(0);

    const [shake, setShake] = useState(false);
    const [selected, setSelected] = useState<Pos | null>(null);

    const [busy, setBusy] = useState(false);
    const [clearing, setClearing] = useState<Set<string>>(new Set());

    const [booster, setBooster] = useState<Booster>(null);
    const opId = useRef(0);

    const won = gems >= targetGem;

    // --- SWIPE/DRAG ---
    const dragRef = useRef<{
        x: number;
        y: number;
        sx: number;
        sy: number;
        moved: boolean;
        pid: number | null;
    } | null>(null);

    const SWIPE_PX = 16;

    const unlockNextAndBack = () => {
        const ratio = moves / movesInit;
        const stars = ratio >= 0.55 ? 3 : ratio >= 0.25 ? 2 : 1;

        const key = `mc_match3_stars_L${level}`;
        const prev = Number(localStorage.getItem(key) || '0');
        if (stars > prev) localStorage.setItem(key, String(stars));

        const cur = Number(localStorage.getItem('mc_match3_unlocked') || '1');
        const next = Math.max(cur, level + 1);
        localStorage.setItem('mc_match3_unlocked', String(next));

        onBack();
    };

    const canInteractCell = (x: number, y: number) => {
        // камень/мёд нельзя двигать
        if (stone[y][x]) return false;
        if (honey[y][x]) return false;
        return true;
    };

    const dirToNeighbor = (x: number, y: number, dx: number, dy: number) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) return null;
        return { x: nx, y: ny };
    };

    const runCascade = async (startBoard: Board, startIce: number[][], startHoney: boolean[][]) => {
        opId.current += 1;
        const my = opId.current;

        let cur = startBoard;
        let curIce = startIce;
        let curHoney = startHoney;
        let chain = 0;

        while (true) {
            const matches = findMatches(cur);
            if (matches.size === 0) break;

            chain += 1;

            setClearing(new Set(matches));
            await sleep(140);
            if (opId.current !== my) return;

            const applied = applyMatchesWithObstacles(cur, matches, curIce, curHoney, stone);

            cur = applied.board;
            curIce = applied.ice;
            curHoney = applied.honey;

            setBoard(cur);
            setIce(curIce);
            setHoney(curHoney);

            if (applied.gemHits > 0) setGems((v) => v + applied.gemHits);

            // очки: очищенные + бонусы
            setScore((s) => s + applied.clearedCount * 10 * chain + applied.brokeIce * 4 + applied.brokeHoney * 6);

            await sleep(120);
            if (opId.current !== my) return;

            // падение + refill
            cur = collapseWithBlocks(cur, stone, curHoney);
            setBoard(cur);
            setClearing(new Set());
            await sleep(140);
            if (opId.current !== my) return;

            cur = refill(cur, stone, curHoney);
            setBoard(cur);
            await sleep(140);
            if (opId.current !== my) return;
        }
    };

    const doBomb = async (x: number, y: number) => {
        setBusy(true);

        const toClear = new Set<string>();
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && ny >= 0 && nx < size && ny < size) {
                    toClear.add(keyOf(nx, ny));
                }
            }
        }

        setClearing(toClear);
        await sleep(180);

        let nextBoard = board.map((r) => r.slice()) as Board;
        const nextIce = ice.map((r) => r.slice());
        const nextHoney = honey.map((r) => r.slice());
        const nextStone = stone.map((r) => r.slice());

        let gemHits = 0;

        for (const k of toClear) {
            const [cx, cy] = k.split(':').map(Number);

            if (nextBoard[cy][cx] === 'GEM') gemHits++;

            // ломаем препятствия
            nextIce[cy][cx] = 0;
            nextHoney[cy][cx] = false;
            if (nextStone[cy][cx]) nextStone[cy][cx] = false;

            nextBoard[cy][cx] = EMPTY;
        }

        setGems((v) => v + gemHits);
        setScore((s) => s + toClear.size * 12);

        setBoard(nextBoard);
        setIce(nextIce);
        setHoney(nextHoney);
        setStone(nextStone);

        await sleep(120);

        nextBoard = collapseWithBlocks(nextBoard, nextStone, nextHoney);
        nextBoard = refill(nextBoard, nextStone, nextHoney);

        setBoard(nextBoard);
        setClearing(new Set());

        await runCascade(nextBoard, nextIce, nextHoney);

        setBooster(null);
        setBusy(false);
    };

    const trySwap = async (a: Pos, b: Pos) => {
        if (busy || moves <= 0 || won) return;

        if (booster === 'BOMB') {
            await doBomb(a.x, a.y);
            return;
        }

        if (!canInteractCell(a.x, a.y) || !canInteractCell(b.x, b.y)) {
            setShake(true);
            setTimeout(() => setShake(false), 220);
            setSelected(null);
            return;
        }

        if (!isNeighbor(a, b)) return;

        setBusy(true);

        const before = board;
        const swapped = swapInBoard(before, a, b);
        setBoard(swapped);
        setSelected(null);

        const matches = findMatches(swapped);

        if (matches.size === 0) {
            await sleep(140);
            setBoard(before);

            setShake(true);
            setTimeout(() => setShake(false), 220);

            setBusy(false);
            return;
        }

        setMoves((m) => Math.max(0, m - 1));
        await runCascade(swapped, ice, honey);

        setBusy(false);
    };

    const onTileTap = async (x: number, y: number) => {
        if (busy || moves <= 0 || won) return;

        if (booster === 'BOMB') {
            await doBomb(x, y);
            return;
        }

        if (!canInteractCell(x, y)) {
            setShake(true);
            setTimeout(() => setShake(false), 220);
            return;
        }

        const cur: Pos = { x, y };

        if (!selected) {
            setSelected(cur);
            return;
        }

        if (selected.x === cur.x && selected.y === cur.y) {
            setSelected(null);
            return;
        }

        if (!canInteractCell(selected.x, selected.y)) {
            setSelected(null);
            return;
        }

        if (!isNeighbor(selected, cur)) {
            setSelected(cur);
            return;
        }

        const a = selected;
        setSelected(null);
        await trySwap(a, cur);
    };

    return (
        <div className="match3-wrap">
            <div className="match3-topbar">
                <button className="match3-back" onClick={onBack}>
                    ⬅ Уровни
                </button>

                <div className="match3-title">🍬 Monster Crush · Level {level}</div>

                <div className="match3-moves">
                    Ходы: {moves} · Очки: {score} · 💎 {gems}/{targetGem}
                </div>
            </div>

            <div className="match3-boosters">
                <button
                    className={`match3-booster-btn ${booster === 'BOMB' ? 'active' : ''}`}
                    onClick={() => setBooster((b) => (b === 'BOMB' ? null : 'BOMB'))}
                    disabled={busy || won}
                    title="Bomb: очистит 3×3"
                >
                    💣 Bomb
                </button>

                <div className="match3-legend">🧊 лёд (2 удара) · 🪨 камень (только 💣) · 🍯 мёд (блок падения)</div>
            </div>

            <div className="match3-stage">
                <div
                    className={`match3-board ${busy ? 'match3-board--busy' : ''} ${shake ? 'match3-board--shake' : ''}`}
                    style={{
                        gridTemplateColumns: `repeat(${size}, ${tile}px)`,
                        gap: `${gap}px`,
                    }}
                >
                    {board.flatMap((row, yy) =>
                        row.map((cell, xx) => {
                            const active = selected?.x === xx && selected?.y === yy;
                            const willClear = clearing.has(keyOf(xx, yy));

                            const hasIce = ice[yy][xx] > 0;
                            const hasStone = stone[yy][xx];
                            const hasHoney = honey[yy][xx];
                            const blocked = hasStone || hasHoney;

                            return (
                                <button
                                    key={`${xx}-${yy}`}
                                    className={[
                                        'match3-tile',
                                        active ? 'match3-tile--selected' : '',
                                        willClear ? 'match3-tile--clearing' : '',
                                        hasIce ? `match3-tile--ice ice-${ice[yy][xx]}` : '',
                                        hasStone ? 'match3-tile--stone' : '',
                                        hasHoney ? 'match3-tile--honey' : '',
                                        blocked ? 'match3-tile--blocked' : '',
                                    ].join(' ')}
                                    style={{ width: tile, height: tile, fontSize: font }}
                                    disabled={busy || won}
                                    onPointerDown={(e) => {
                                        if (busy || moves <= 0 || won) return;
                                        (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
                                        dragRef.current = {
                                            x: xx,
                                            y: yy,
                                            sx: e.clientX,
                                            sy: e.clientY,
                                            moved: false,
                                            pid: e.pointerId,
                                        };
                                    }}
                                    onPointerMove={(e) => {
                                        const d = dragRef.current;
                                        if (!d) return;
                                        if (d.pid !== e.pointerId) return;

                                        const dx = e.clientX - d.sx;
                                        const dy = e.clientY - d.sy;
                                        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) d.moved = true;
                                    }}
                                    onPointerUp={async (e) => {
                                        const d = dragRef.current;
                                        dragRef.current = null;

                                        if (!d) {
                                            await onTileTap(xx, yy);
                                            return;
                                        }

                                        const dx = e.clientX - d.sx;
                                        const dy = e.clientY - d.sy;

                                        // tap
                                        if (Math.abs(dx) < SWIPE_PX && Math.abs(dy) < SWIPE_PX) {
                                            await onTileTap(d.x, d.y);
                                            return;
                                        }

                                        // swipe direction
                                        const horiz = Math.abs(dx) >= Math.abs(dy);
                                        const step = horiz
                                            ? { dx: dx > 0 ? 1 : -1, dy: 0 }
                                            : { dx: 0, dy: dy > 0 ? 1 : -1 };

                                        const a = { x: d.x, y: d.y };
                                        const b = dirToNeighbor(a.x, a.y, step.dx, step.dy);
                                        if (!b) return;

                                        await trySwap(a, b);
                                    }}
                                >
                                    {/* ✅ STONE оставляем emoji */}
                                    {hasStone ? (
                                        '🪨'
                                    ) : cell ? (
                                        <img
                                            src={TILE_ICON[cell]}
                                            className={`tile-icon ${cell === 'GEM' ? 'breathe' : ''}`}
                                            draggable={false}
                                            alt={cell}
                                        />
                                    ) : null}

                                    {/* ✅ ICE оставляем emoji overlay */}
                                    {hasIce && <span className="match3-ice-overlay">{ice[yy][xx] === 2 ? '🧊' : '❄️'}</span>}

                                    {/* ✅ HONEY как было */}
                                    {hasHoney && <span className="match3-honey-overlay">🍯</span>}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {won && (
                <div className="match3-over">
                    <div className="match3-over-card">
                        <div className="match3-over-title">Победа! 🎉</div>
                        <div style={{ opacity: 0.9, marginBottom: 10 }}>
                            Ты собрал 💎 {gems}/{targetGem}
                        </div>

                        <button className="match3-back" onClick={unlockNextAndBack}>
                            ✅ Забрать и открыть следующий
                        </button>
                    </div>
                </div>
            )}

            {moves <= 0 && !busy && !won && (
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
