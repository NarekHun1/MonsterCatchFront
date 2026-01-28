export type ShapeId =
    | 'RECT'
    | 'DIAMOND'
    | 'RING'
    | 'HOURGLASS'
    | 'STAIRS'
    | 'ISLANDS'
    | 'CROSS';

function clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n));
}

function gridBool(rows: number, cols: number, v: boolean) {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => v));
}

export function buildMask(shape: ShapeId, rows: number, cols: number): boolean[][] {
    const mask = gridBool(rows, cols, true);

    if (shape === 'RECT') return mask;

    if (shape === 'DIAMOND') {
        const cy = (rows - 1) / 2;
        const cx = (cols - 1) / 2;
        const r = Math.floor(Math.min(rows, cols) / 2);

        return gridBool(rows, cols, false).map((row, y) =>
            row.map((_, x) => Math.abs(x - cx) + Math.abs(y - cy) <= r)
        );
    }

    if (shape === 'RING') {
        const border = 1; // толщина кольца
        return gridBool(rows, cols, true).map((row, y) =>
            row.map((_, x) => {
                const outer = x >= 0 && y >= 0 && x < cols && y < rows;
                const inner =
                    x >= border && y >= border && x < cols - border && y < rows - border;
                return outer && !inner; // только рамка
            })
        );
    }

    if (shape === 'HOURGLASS') {
        return gridBool(rows, cols, false).map((row, y) =>
            row.map((_, x) => {
                const t = y <= (rows - 1) / 2 ? y : rows - 1 - y;
                const w = clamp(2 + t * 2, 2, cols);
                const left = Math.floor((cols - w) / 2);
                return x >= left && x < left + w;
            })
        );
    }

    if (shape === 'STAIRS') {
        return gridBool(rows, cols, false).map((row, y) =>
            row.map((_, x) => x <= clamp(y + 2, 0, cols - 1))
        );
    }

    if (shape === 'ISLANDS') {
        return gridBool(rows, cols, false).map((row, y) =>
            row.map((_, x) => {
                const left = x <= Math.floor(cols / 2) - 2 && y >= 1 && y <= rows - 2;
                const right = x >= Math.floor(cols / 2) + 2 && y >= 1 && y <= rows - 2;
                return left || right;
            })
        );
    }

    if (shape === 'CROSS') {
        const cx = Math.floor(cols / 2);
        const cy = Math.floor(rows / 2);
        return gridBool(rows, cols, false).map((row, y) =>
            row.map((_, x) => x === cx || y === cy || (Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1))
        );
    }

    return mask;
}
