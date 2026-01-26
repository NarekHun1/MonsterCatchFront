export interface Match3LevelConfig {
    id: number;
    name: string;
    size: number; // поле NxN
    moves: number;
}

export const MATCH3_LEVELS: Match3LevelConfig[] = [
    { id: 1, name: 'Forest', size: 6, moves: 20 },
    { id: 2, name: 'Candy Land', size: 7, moves: 18 },
    { id: 3, name: 'Lava World', size: 8, moves: 15 },
];
