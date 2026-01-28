import type { LevelConfig, TileType } from './levels';
import { buildMask, type ShapeId } from './shapes';

const ALL: TileType[] = ['DEMON', 'COIN', 'GEM', 'FIRE', 'CLOVER'];

function gridNum(rows: number, cols: number, v: number) {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => v));
}
function gridBool(rows: number, cols: number, v: boolean) {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => v));
}

function emptyObstacles(rows: number, cols: number) {
    return {
        ice: gridNum(rows, cols, 0),
        honey: gridBool(rows, cols, false),
        stone: gridBool(rows, cols, false),
    };
}

function placeRandom(
    mask: boolean[][],
    target: (x: number, y: number) => void,
    count: number
) {
    const rows = mask.length;
    const cols = mask[0].length;
    let i = 0;
    let guard = 0;
    while (i < count && guard < 2000) {
        guard++;
        const x = Math.floor(Math.random() * cols);
        const y = Math.floor(Math.random() * rows);
        if (!mask[y][x]) continue;
        target(x, y);
        i++;
    }
}

function makeLevel(
    id: number,
    rows: number,
    cols: number,
    shape: ShapeId,
    theme: LevelConfig['theme'],
    moves: number
): LevelConfig {
    const mask = buildMask(shape, rows, cols);
    const obs = emptyObstacles(rows, cols);

    // пример: на некоторых формах красиво смотрится лёд по краям
    if (id >= 3) {
        placeRandom(mask, (x, y) => (obs.ice[y][x] = 2), Math.min(10, 2 + id));
    }
    if (id >= 6) {
        placeRandom(mask, (x, y) => {
            obs.honey[y][x] = true;
            if (obs.ice[y][x] > 0) obs.ice[y][x] = 1;
        }, Math.min(7, 2 + Math.floor(id / 2)));
    }
    if (id >= 10) {
        placeRandom(mask, (x, y) => {
            obs.stone[y][x] = true;
            obs.ice[y][x] = 0;
            obs.honey[y][x] = false;
        }, Math.min(6, 1 + Math.floor(id / 3)));
    }

    // цель: пока пример — потом сделаем смесь целей
    const objectives: LevelConfig['objectives'] =
        id % 4 === 0
            ? [{ type: 'SCORE', amount: 1000 + id * 120 }]
            : [{ type: 'COLLECT', tile: 'GEM', amount: Math.min(40, 10 + id * 2) }];

    return {
        id,
        rows,
        cols,
        moves,
        mask,
        ...obs,
        objectives,
        theme,
        allowedTiles: ALL,
    };
}

export const MATCH3_LEVELS: LevelConfig[] = [
    makeLevel(1, 7, 7, 'RECT', 'FOREST', 22),
    makeLevel(2, 7, 7, 'DIAMOND', 'FOREST', 21),
    makeLevel(3, 8, 8, 'HOURGLASS', 'ICE', 20),
    makeLevel(4, 8, 8, 'RING', 'HONEY', 19),
    makeLevel(5, 8, 8, 'STAIRS', 'LAVA', 18),
    makeLevel(6, 8, 8, 'ISLANDS', 'DUNGEON', 18),
    makeLevel(7, 9, 9, 'CROSS', 'ICE', 17),
];
