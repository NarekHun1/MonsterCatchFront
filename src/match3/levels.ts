// src/match3/levels.ts

export type TileType = 'DEMON' | 'COIN' | 'GEM' | 'FIRE' | 'CLOVER';

export type Objective =
    | { type: 'COLLECT'; tile: TileType; amount: number }
    | { type: 'BREAK_ICE'; amount: number }
    | { type: 'CLEAR_HONEY'; amount: number }
    | { type: 'DESTROY_STONE'; amount: number }
    | { type: 'SCORE'; amount: number };

export type ThemeId = 'FOREST' | 'ICE' | 'HONEY' | 'LAVA' | 'DUNGEON';

export type LevelConfig = {
    id: number;

    // ✅ теперь не size
    rows: number;
    cols: number;

    moves: number;

    // ✅ форма поля (дырки)
    mask: boolean[][];

    // препятствия
    ice: number[][];
    honey: boolean[][];
    stone: boolean[][];

    // цели
    objectives: Objective[];

    // тема
    theme: ThemeId;

    // какие тайлы разрешены
    allowedTiles: TileType[];
};
