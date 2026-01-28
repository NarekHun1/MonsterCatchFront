// src/Match3Level.tsx
import './match3.css';
import { useMemo, useRef, useState } from 'react';
import { getLevelConfig } from './levelGen';

// assets (Vite safe for Telegram)
import demonImg from '../assets/tiles/monster-2.png';
import coinImg from '../assets/tiles/cute.png';
import gemImg from '../assets/tiles/monster-3.png';
import fireImg from '../assets/tiles/monster-4.png';
import cloverImg from '../assets/tiles/monster.png';

const EMPTY = '' as const;

const TYPES = ['DEMON', 'COIN', 'GEM', 'FIRE', 'CLOVER'] as const;
type TileType = (typeof TYPES)[number];

type Cell = TileType | typeof EMPTY;
type Board = Cell[][];
type Pos = { x: number; y: number };
type Booster = 'BOMB' | null;

// ✅ Vite asset URLs
const TILE_ICON: Record<TileType, string> = {
    DEMON: demonImg,
    COIN: coinImg,
    GEM: gemImg,
    FIRE: fireImg,
    CLOVER: cloverImg,
};

// ✅ emoji fallback (only if img breaks)
const TILE_FALLBACK: Record<TileType, string> = {
    DEMON: '😈',
    COIN: '🪙',
    GEM: '👾',
    FIRE: '🔥',
    CLOVER: '🍀',
};

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function keyOf(x: number, y: number) {
    return `${x}:${y}`;
}

function isNeighbor(a: Pos, b: Pos) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

function getUiForSize(rows: number, cols: number) {
    const max = Math.max(rows, cols);
    if (max <= 6) return { tile: 52, gap: 10, font: 26 };
    if (max === 7) return { tile: 44, gap: 8, font: 24 };
    if (max === 8) return { tile: 38, gap: 7, font: 22 };
    return { tile: 34, gap: 6, font: 20 };
}

function randomTile(allowed: TileType[]): TileType {
    return allowed[Math.floor(Math.random() * allowed.length)];
}

/** ✅ Find matches on masked board (skip holes + empty) */
function findMatches(board: Board, mask: boolean[][]): Set<string> {
    const rows = board.length;
    const cols = board[0].length;
    const matched = new Set<string>();

    // horizontal
    for (let y = 0; y < rows; y++) {
        let runStart = 0;

        for (let x = 1; x <= cols; x++) {
            const prevValid = mask[y][x - 1];
            const prev: Cell = prevValid ? board[y][x - 1] : EMPTY;

            const curValid = x < cols ? mask[y][x] : false;
            const cur: Cell = x < cols && curValid ? board[y][x] : EMPTY;

            if (cur !== prev || prev === EMPTY) {
                const runLen = x - runStart;
                if (prev !== EMPTY && runLen >= 3) {
                    for (let k = runStart; k < x; k++) {
                        if (mask[y][k]) matched.add(keyOf(k, y));
                    }
                }
                runStart = x;
            }
        }
    }

    // vertical
    for (let x = 0; x < cols; x++) {
        let runStart = 0;

        for (let y = 1; y <= rows; y++) {
            const prevValid = mask[y - 1][x];
            const prev: Cell = prevValid ? board[y - 1][x] : EMPTY;

            const curValid = y < rows ? mask[y][x] : false;
            const cur: Cell = y < rows && curValid ? board[y][x] : EMPTY;

            if (cur !== prev || prev === EMPTY) {
                const runLen = y - runStart;
                if (prev !== EMPTY && runLen >= 3) {
                    for (let k = runStart; k < y; k++) {
                        if (mask[k][x]) matched.add(keyOf(x, k));
                    }
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

/** ✅ gen board on mask and avoid start matches */
function genBoard(rows: number, cols: number, mask: boolean[][], allowed: TileType[]) {
    const b: Board = Array.from({ length: rows }, (_, y) =>
        Array.from({ length: cols }, (_, x) => (mask[y][x] ? randomTile(allowed) : EMPTY))
    );

    // try remove initial matches
    for (let i = 0; i < 6; i++) {
        const m = findMatches(b, mask);
        if (m.size === 0) break;
        for (const k of m) {
            const [x, y] = k.split(':').map(Number);
            b[y][x] = randomTile(allowed);
        }
    }

    return b;
}

/** ✅ clear matches with obstacles (skip holes) */
function applyMatchesWithObstacles(
    board: Board,
    matches: Set<string>,
    mask: boolean[][],
    ice: number[][],
    honey: boolean[][],
    stone: boolean[][]
) {
    const nextBoard = board.map((r) => r.slice()) as Board;
    const nextIce = ice.map((r) => r.slice());
    const nextHoney = honey.map((r) => r.slice());
    const nextStone = stone.map((r) => r.slice());

    let clearedCount = 0;
    let gemHits = 0;
    let brokeIce = 0;
    let brokeHoney = 0;

    for (const k of matches) {
        const [x, y] = k.split(':').map(Number);
        if (!mask[y][x]) continue;

        // stone not cleared by match
        if (nextStone[y][x]) continue;

        // ice first
        if (nextIce[y][x] > 0) {
            nextIce[y][x] = Math.max(0, nextIce[y][x] - 1);
            brokeIce++;
            if (nextIce[y][x] > 0) continue;
        }

        // honey removed by 1 hit
        if (nextHoney[y][x]) {
            nextHoney[y][x] = false;
            brokeHoney++;
        }

        if (nextBoard[y][x] === 'GEM') gemHits++;

        nextBoard[y][x] = EMPTY;
        clearedCount++;
    }

    return {
        board: nextBoard,
        ice: nextIce,
        honey: nextHoney,
        stone: nextStone,
        clearedCount,
        gemHits,
        brokeIce,
        brokeHoney,
    };
}

/**
 * ✅ Collapse with blocks + mask.
 * Holes are ignored. Column collapses only within existing cells.
 * Honey/Stone stay fixed and block fall-through.
 */
function collapseWithBlocks(board: Board, mask: boolean[][], stone: boolean[][], honey: boolean[][]) {
    const rows = board.length;
    const cols = board[0].length;

    const next: Board = Array.from({ length: rows }, () => Array.from({ length: cols }, () => EMPTY));

    // keep holes empty
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (!mask[y][x]) next[y][x] = EMPTY;
        }
    }

    for (let x = 0; x < cols; x++) {
        const ys: number[] = [];
        for (let y = 0; y < rows; y++) if (mask[y][x]) ys.push(y);

        let writeIdx = ys.length - 1;

        for (let idx = ys.length - 1; idx >= 0; idx--) {
            const y = ys[idx];

            if (stone[y][x] || honey[y][x]) {
                next[y][x] = board[y][x];
                writeIdx = idx - 1;
                continue;
            }

            const v = board[y][x];
            if (v === EMPTY) continue;

            while (writeIdx >= 0) {
                const wy = ys[writeIdx];
                if (stone[wy][x] || honey[wy][x]) {
                    next[wy][x] = board[wy][x];
                    writeIdx--;
                    continue;
                }
                break;
            }

            if (writeIdx >= 0) {
                const wy = ys[writeIdx];
                next[wy][x] = v;
                writeIdx--;
            }
        }
    }

    return next;
}

function refill(board: Board, mask: boolean[][], stone: boolean[][], honey: boolean[][], allowed: TileType[]) {
    const rows = board.length;
    const cols = board[0].length;
    const next = board.map((r) => r.slice()) as Board;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (!mask[y][x]) continue;
            if (stone[y][x] || honey[y][x]) continue;
            if (next[y][x] === EMPTY) next[y][x] = randomTile(allowed);
        }
    }

    return next;
}

/** ✅ AUTO-SWAP: find best neighbor swap from cell (x,y) that creates match */
function bestSwapFromCell(
    board: Board,
    mask: boolean[][],
    stone: boolean[][],
    honey: boolean[][],
    x: number,
    y: number
): Pos | null {
    const rows = board.length;
    const cols = board[0].length;

    const inBounds = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < cols && yy < rows;
    const hole = (xx: number, yy: number) => !mask[yy][xx];
    const blocked = (xx: number, yy: number) => stone[yy][xx] || honey[yy][xx];

    if (!inBounds(x, y) || hole(x, y) || blocked(x, y)) return null;

    const dirs = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
    ];

    let best: { pos: Pos; score: number } | null = null;

    for (const d of dirs) {
        const nx = x + d.dx;
        const ny = y + d.dy;

        if (!inBounds(nx, ny) || hole(nx, ny) || blocked(nx, ny)) continue;

        const swapped = swapInBoard(board, { x, y }, { x: nx, y: ny });
        const matches = findMatches(swapped, mask);

        if (matches.size > 0) {
            const score = matches.size; // bigger is better
            if (!best || score > best.score) best = { pos: { x: nx, y: ny }, score };
        }
    }

    return best?.pos ?? null;
}

/* ─────────────────────────────────────────────
   ✅ HINT + NO-MOVES RESHUFFLE
───────────────────────────────────────────── */

type MoveHint = { a: Pos; b: Pos; score: number };

function findAnyMove(board: Board, mask: boolean[][], stone: boolean[][], honey: boolean[][]): MoveHint | null {
    const rows = board.length;
    const cols = board[0].length;

    const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows;
    const hole = (x: number, y: number) => !mask[y][x];
    const blocked = (x: number, y: number) => stone[y][x] || honey[y][x];

    const dirs = [
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: -1 },
    ];

    let best: MoveHint | null = null;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (!inBounds(x, y) || hole(x, y) || blocked(x, y)) continue;
            if (board[y][x] === EMPTY) continue;

            for (const d of dirs) {
                const nx = x + d.dx;
                const ny = y + d.dy;
                if (!inBounds(nx, ny) || hole(nx, ny) || blocked(nx, ny)) continue;
                if (board[ny][nx] === EMPTY) continue;

                const swapped = swapInBoard(board, { x, y }, { x: nx, y: ny });
                const matches = findMatches(swapped, mask);
                if (matches.size > 0) {
                    const score = matches.size;
                    if (!best || score > best.score) best = { a: { x, y }, b: { x: nx, y: ny }, score };
                }
            }
        }
    }

    return best;
}

function hasAnyMoves(board: Board, mask: boolean[][], stone: boolean[][], honey: boolean[][]) {
    return findAnyMove(board, mask, stone, honey) !== null;
}

function reshuffleBoard(
    board: Board,
    mask: boolean[][],
    stone: boolean[][],
    honey: boolean[][],
    allowed: TileType[]
): Board {
    const rows = board.length;
    const cols = board[0].length;

    // positions we can reshuffle (not holes, not blocked)
    const cells: Pos[] = [];
    const bag: TileType[] = [];

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (!mask[y][x]) continue;
            if (stone[y][x] || honey[y][x]) continue;

            const v = board[y][x];
            if (v !== EMPTY) {
                cells.push({ x, y });
                bag.push(v as TileType);
            }
        }
    }

    if (cells.length < 3) {
        return genBoard(rows, cols, mask, allowed);
    }

    const shuffle = <T,>(arr: T[]) => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    };

    for (let attempt = 0; attempt < 40; attempt++) {
        const mixed = shuffle(bag);

        const next = board.map((r) => r.slice()) as Board;
        for (let i = 0; i < cells.length; i++) {
            const { x, y } = cells[i];
            next[y][x] = mixed[i];
        }

        // remove start matches by small random replacements
        for (let i = 0; i < 6; i++) {
            const m = findMatches(next, mask);
            if (m.size === 0) break;

            for (const k of m) {
                const [x, y] = k.split(':').map(Number);
                if (!mask[y][x]) continue;
                if (stone[y][x] || honey[y][x]) continue;
                next[y][x] = randomTile(allowed);
            }
        }

        if (findMatches(next, mask).size === 0 && hasAnyMoves(next, mask, stone, honey)) {
            return next;
        }
    }

    return genBoard(rows, cols, mask, allowed);
}

export default function Match3Level({ level, onBack }: { level: number; onBack: () => void }) {
    const cfg = useMemo(() => getLevelConfig(level), [level]);

    const rows = cfg.rows;
    const cols = cfg.cols;
    const mask = cfg.mask;

    const movesInit = cfg.moves;

    // Step 1: win by collect GEM amount
    const targetGem = cfg.objectives.find((o) => o.type === 'COLLECT' && o.tile === 'GEM')?.amount ?? 15;

    const { tile, gap, font } = getUiForSize(rows, cols);

    const initialBoard = useMemo(() => genBoard(rows, cols, mask, cfg.allowedTiles), [rows, cols, level]);
    const [board, setBoard] = useState<Board>(initialBoard);

    // obstacles from config (make local copies)
    const [ice, setIce] = useState<number[][]>(() => cfg.ice.map((r) => r.slice()));
    const [stone, setStone] = useState<boolean[][]>(() => cfg.stone.map((r) => r.slice()));
    const [honey, setHoney] = useState<boolean[][]>(() => cfg.honey.map((r) => r.slice()));

    const [moves, setMoves] = useState<number>(movesInit);
    const [score, setScore] = useState<number>(0);
    const [gems, setGems] = useState<number>(0);

    const [shake, setShake] = useState(false);
    const [selected, setSelected] = useState<Pos | null>(null);

    const [busy, setBusy] = useState(false);
    const [clearing, setClearing] = useState<Set<string>>(new Set());

    const [booster, setBooster] = useState<Booster>(null);
    const opId = useRef(0);

    // img broken map per cell (x:y)
    const [imgBroken, setImgBroken] = useState<Record<string, boolean>>({});

    // ✅ hint
    const [hint, setHint] = useState<MoveHint | null>(null);

    const won = gems >= targetGem;

    // drag/swipe
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

    const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows;
    const isHole = (x: number, y: number) => !mask[y][x];
    const blockedCell = (x: number, y: number) => stone[y][x] || honey[y][x];
    const canInteractCell = (x: number, y: number) => inBounds(x, y) && !isHole(x, y) && !blockedCell(x, y);

    const dirToNeighbor = (x: number, y: number, dx: number, dy: number) => {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) return null;
        if (isHole(nx, ny)) return null;
        return { x: nx, y: ny };
    };

    const showHint = (srcBoard = board, srcStone = stone, srcHoney = honey) => {
        const h = findAnyMove(srcBoard, mask, srcStone, srcHoney);
        setHint(h);
        window.setTimeout(() => setHint(null), 1200);
    };

    const runCascade = async (startBoard: Board, startIce: number[][], startHoney: boolean[][], startStone: boolean[][]) => {
        opId.current += 1;
        const my = opId.current;

        let cur = startBoard;
        let curIce = startIce;
        let curHoney = startHoney;
        let curStone = startStone;
        let chain = 0;

        while (true) {
            const matches = findMatches(cur, mask);
            if (matches.size === 0) break;

            chain += 1;

            setClearing(new Set(matches));
            await sleep(140);
            if (opId.current !== my) return;

            const applied = applyMatchesWithObstacles(cur, matches, mask, curIce, curHoney, curStone);

            cur = applied.board;
            curIce = applied.ice;
            curHoney = applied.honey;
            curStone = applied.stone;

            setBoard(cur);
            setIce(curIce);
            setHoney(curHoney);
            setStone(curStone);

            if (applied.gemHits) setGems((v) => v + applied.gemHits);

            setScore((s) => s + applied.clearedCount * 10 * chain + applied.brokeIce * 4 + applied.brokeHoney * 6);

            await sleep(120);
            if (opId.current !== my) return;

            cur = collapseWithBlocks(cur, mask, curStone, curHoney);
            setBoard(cur);
            setClearing(new Set());

            await sleep(140);
            if (opId.current !== my) return;

            cur = refill(cur, mask, curStone, curHoney, cfg.allowedTiles);
            setBoard(cur);

            await sleep(140);
            if (opId.current !== my) return;
        }

        // ✅ after cascade: if NO moves -> reshuffle
        if (!hasAnyMoves(cur, mask, curStone, curHoney)) {
            const reshuffled = reshuffleBoard(cur, mask, curStone, curHoney, cfg.allowedTiles);
            setBoard(reshuffled);
            setClearing(new Set());
            setSelected(null);

            // optional: show hint after reshuffle
            const h = findAnyMove(reshuffled, mask, curStone, curHoney);
            setHint(h);
            window.setTimeout(() => setHint(null), 900);
        }
    };

    const doBomb = async (x: number, y: number) => {
        if (isHole(x, y)) return;

        setBusy(true);
        setHint(null);

        const toClear = new Set<string>();
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (!inBounds(nx, ny)) continue;
                if (isHole(nx, ny)) continue;
                toClear.add(keyOf(nx, ny));
            }
        }

        setClearing(toClear);
        await sleep(180);

        let nextBoard = board.map((r) => r.slice()) as Board;
        const nextIce = ice.map((r) => r.slice());
        const nextHoney = honey.map((r) => r.slice());
        const nextStone = stone.map((r) => r.slice());

        let gemHits = 0;

        // clear broken cache for cells we touch
        setImgBroken((prev) => {
            const n = { ...prev };
            for (const kk of toClear) delete n[kk];
            return n;
        });

        for (const kk of toClear) {
            const [cx, cy] = kk.split(':').map(Number);

            if (nextBoard[cy][cx] === 'GEM') gemHits++;

            // bomb destroys everything
            nextIce[cy][cx] = 0;
            nextHoney[cy][cx] = false;
            nextStone[cy][cx] = false;

            nextBoard[cy][cx] = EMPTY;
        }

        setGems((v) => v + gemHits);
        setScore((s) => s + toClear.size * 12);

        setBoard(nextBoard);
        setIce(nextIce);
        setHoney(nextHoney);
        setStone(nextStone);

        await sleep(120);

        nextBoard = collapseWithBlocks(nextBoard, mask, nextStone, nextHoney);
        nextBoard = refill(nextBoard, mask, nextStone, nextHoney, cfg.allowedTiles);

        setBoard(nextBoard);
        setClearing(new Set());

        await runCascade(nextBoard, nextIce, nextHoney, nextStone);

        setBooster(null);
        setBusy(false);
    };

    /** ✅ TRY SWAP + AUTO-SWAP ALWAYS */
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
            showHint();
            return;
        }

        if (!isNeighbor(a, b)) return;

        setBusy(true);
        setHint(null);

        const before = board;

        // 1) do user swap
        const swapped = swapInBoard(before, a, b);
        setBoard(swapped);
        setSelected(null);

        let matches = findMatches(swapped, mask);

        if (matches.size === 0) {
            // 2) AUTO-SWAP: find best neighbor from cell "a"
            const autoB = bestSwapFromCell(before, mask, stone, honey, a.x, a.y);

            if (autoB) {
                await sleep(110);

                const autoSwapped = swapInBoard(before, a, autoB);
                setBoard(autoSwapped);

                matches = findMatches(autoSwapped, mask);

                if (matches.size > 0) {
                    setMoves((m) => Math.max(0, m - 1));
                    await runCascade(autoSwapped, ice, honey, stone);
                    setBusy(false);
                    return;
                }
            }

            // 3) revert if nothing works
            await sleep(140);
            setBoard(before);
            setShake(true);
            setTimeout(() => setShake(false), 220);

            // ✅ show hint after bad move
            showHint(before, stone, honey);

            setBusy(false);
            return;
        }

        // normal success
        setMoves((m) => Math.max(0, m - 1));
        await runCascade(swapped, ice, honey, stone);
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
            showHint();
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
        <div className={`match3-wrap theme-${cfg.theme}`}>
            <div className="match3-topbar">
                <button className="match3-back" onClick={onBack}>
                    ⬅ Уровни
                </button>

                <div className="match3-title">🍬 Monster Crush · Level {level}</div>

                <div className="match3-moves">
                    Ходы: {moves} · Очки: {score} ·
                    <span className="match3-goal">
            <img className="match3-goal-icon" src={TILE_ICON.GEM} alt="GEM" />
                        {gems}/{targetGem}
          </span>
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

                <button
                    className="match3-booster-btn"
                    onClick={() => showHint()}
                    disabled={busy || won}
                    title="Подсказка"
                >
                    💡 Hint
                </button>

                <button
                    className="match3-booster-btn"
                    onClick={() => {
                        if (busy || won) return;
                        const reshuffled = reshuffleBoard(board, mask, stone, honey, cfg.allowedTiles);
                        setBoard(reshuffled);
                        setSelected(null);
                        setClearing(new Set());
                        showHint(reshuffled, stone, honey);
                    }}
                    disabled={busy || won}
                    title="Перемешать (если не хочешь ждать auto)"
                >
                    🔀 Shuffle
                </button>

                <div className="match3-legend">🧊 лёд (2 удара) · 🪨 камень (только 💣) · 🍯 мёд (блок падения)</div>
            </div>

            <div className="match3-stage">
                <div
                    className={`match3-board ${busy ? 'match3-board--busy' : ''} ${shake ? 'match3-board--shake' : ''}`}
                    style={{
                        gridTemplateColumns: `repeat(${cols}, ${tile}px)`,
                        gap: `${gap}px`,
                    }}
                >
                    {board.flatMap((row, yy) =>
                        row.map((cell, xx) => {
                            const hole = !mask[yy][xx];
                            if (hole) {
                                return <div key={`${xx}-${yy}`} className="match3-hole" style={{ width: tile, height: tile }} />;
                            }

                            const active = selected?.x === xx && selected?.y === yy;
                            const willClear = clearing.has(keyOf(xx, yy));

                            const hasIce = ice[yy][xx] > 0;
                            const hasStone = stone[yy][xx];
                            const hasHoney = honey[yy][xx];
                            const blocked = hasStone || hasHoney;

                            const k = keyOf(xx, yy);

                            const hinted =
                                !!hint && ((hint.a.x === xx && hint.a.y === yy) || (hint.b.x === xx && hint.b.y === yy));

                            return (
                                <div
                                    key={`${xx}-${yy}`}
                                    role="button"
                                    tabIndex={0}
                                    aria-disabled={busy || won}
                                    className={[
                                        'match3-tile',
                                        active ? 'match3-tile--selected' : '',
                                        willClear ? 'match3-tile--clearing' : '',
                                        hinted ? 'match3-tile--hint' : '',
                                        hasIce ? `match3-tile--ice ice-${ice[yy][xx]}` : '',
                                        hasStone ? 'match3-tile--stone' : '',
                                        hasHoney ? 'match3-tile--honey' : '',
                                        blocked ? 'match3-tile--blocked' : '',
                                        busy || won ? 'match3-tile--disabled' : '',
                                    ].join(' ')}
                                    style={{ width: tile, height: tile, fontSize: font }}
                                    onPointerDown={(e) => {
                                        if (busy || moves <= 0 || won) return;
                                        (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);

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
                                        if (busy || moves <= 0 || won) return;

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
                                    onPointerCancel={() => (dragRef.current = null)}
                                    onPointerLeave={() => (dragRef.current = null)}
                                    onClick={async () => {
                                        if (busy || moves <= 0 || won) return;
                                        await onTileTap(xx, yy);
                                    }}
                                    onKeyDown={async (e) => {
                                        if (busy || moves <= 0 || won) return;
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            await onTileTap(xx, yy);
                                        }
                                    }}
                                >
                                    {/* STONE */}
                                    {hasStone ? (
                                        <span className="tile-fallback tile-fallback--stone">🪨</span>
                                    ) : cell ? (
                                        <>
                                            {/* IMG */}
                                            {!imgBroken[k] && (
                                                <img
                                                    src={TILE_ICON[cell]}
                                                    className={`tile-icon ${cell === 'GEM' ? 'breathe' : ''}`}
                                                    draggable={false}
                                                    alt={cell}
                                                    onError={() => setImgBroken((prev) => ({ ...prev, [k]: true }))}
                                                />
                                            )}

                                            {/* FALLBACK */}
                                            {imgBroken[k] && <span className="tile-fallback">{TILE_FALLBACK[cell]}</span>}
                                        </>
                                    ) : null}

                                    {/* ICE overlay */}
                                    {hasIce && <span className="match3-ice-overlay">{ice[yy][xx] === 2 ? '🧊' : '❄️'}</span>}

                                    {/* HONEY overlay */}
                                    {hasHoney && <span className="match3-honey-overlay">🍯</span>}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* overlays */}
            {won && (
                <div className="match3-over">
                    <div className="match3-over-card">
                        <div className="match3-over-title">Победа! 🎉</div>

                        <div
                            style={{
                                opacity: 0.9,
                                marginBottom: 10,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                justifyContent: 'center',
                            }}
                        >
                            Ты собрал
                            <img className="match3-goal-icon" src={TILE_ICON.GEM} alt="GEM" />
                            {gems}/{targetGem}
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
