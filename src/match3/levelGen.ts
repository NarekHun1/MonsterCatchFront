// src/match3/levelGen.ts
import type { LevelConfig, TileType, ThemeId } from './levels';
import { buildMask, type ShapeId } from './shapes';

const ALL_TILES: TileType[] = ['DEMON', 'COIN', 'GEM', 'FIRE', 'CLOVER'];

function clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n));
}

function gridNum(rows: number, cols: number, v: number) {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => v));
}

function gridBool(rows: number, cols: number, v: boolean) {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => v));
}

function themeByLevel(level: number): ThemeId {
    const themes: ThemeId[] = ['FOREST', 'ICE', 'HONEY', 'LAVA', 'DUNGEON'];
    return themes[(level - 1) % themes.length];
}

function shapeByLevel(level: number): ShapeId {
    const shapes: ShapeId[] = ['RECT', 'DIAMOND', 'HOURGLASS', 'RING', 'STAIRS', 'ISLANDS', 'CROSS'];
    return shapes[(level - 1) % shapes.length];
}

function placeRandom(mask: boolean[][], count: number, cb: (x: number, y: number) => void) {
    const rows = mask.length;
    const cols = mask[0].length;
    let placed = 0;
    let guard = 0;

    while (placed < count && guard < 5000) {
        guard++;
        const x = Math.floor(Math.random() * cols);
        const y = Math.floor(Math.random() * rows);
        if (!mask[y][x]) continue;
        cb(x, y);
        placed++;
    }
}

export function getLevelConfig(level: number): LevelConfig {
    // размеры (можешь поменять как тебе нравится)
    const rows = level <= 2 ? 6 : level <= 15 ? 7 : level <= 80 ? 8 : 9;
    const cols = rows;

    const theme = themeByLevel(level);
    const shape = shapeByLevel(level);

    // ✅ форма (дырки)
    const mask = buildMask(shape, rows, cols);

    // ходы
    const moves = clamp(24 - Math.floor(level / 3), 10, 26);

    // препятствия
    const ice = gridNum(rows, cols, 0);
    const honey = gridBool(rows, cols, false);
    const stone = gridBool(rows, cols, false);

    // 🧊 лёд с 3 уровня
    if (level >= 3) {
        placeRandom(mask, clamp(2 + level, 3, 14), (x, y) => {
            ice[y][x] = 2;
        });
    }

    // 🍯 мёд с 7 уровня (блокирует падение)
    if (level >= 7) {
        placeRandom(mask, clamp(2 + Math.floor(level / 2), 3, 10), (x, y) => {
            if (stone[y][x]) return;
            honey[y][x] = true;
            if (ice[y][x] > 0) ice[y][x] = 1;
        });
    }

    // 🪨 камни с 10 уровня
    if (level >= 10) {
        placeRandom(mask, clamp(1 + Math.floor(level / 3), 2, 8), (x, y) => {
            stone[y][x] = true;
            honey[y][x] = false;
            ice[y][x] = 0;
        });
    }

    // ✅ цели (пока простые; дальше сделаем умные миксы)
    const objectives: LevelConfig['objectives'] =
        level % 5 === 0
            ? [{ type: 'SCORE', amount: 1200 + level * 120 }]
            : [{ type: 'COLLECT', tile: 'GEM', amount: clamp(10 + level * 2, 10, 45) }];

    return {
        id: level,
        rows,
        cols,
        moves,
        mask,
        ice,
        honey,
        stone,
        objectives,
        theme,
        allowedTiles: ALL_TILES,
    };
}
