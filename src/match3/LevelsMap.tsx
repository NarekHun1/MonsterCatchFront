// src/LevelsMap.tsx
import './match3.css';

const TOTAL_LEVELS = 1000;

// сколько уровней видно на экране
const WINDOW_LEVELS = 10;

// сколько уровней в "одном шаге прогресса" (ты хотел: прошёл 5 → поднялись)
const STEP = 5;

function getStars(level: number) {
    return Number(localStorage.getItem(`mc_match3_stars_L${level}`) || '0'); // 0..3
}

export default function LevelsMap({ onSelect }: { onSelect: (lvl: number) => void }) {
    const unlockedMax = Number(localStorage.getItem('mc_match3_unlocked') || '1');

    // ✅ вычисляем "окно" (сдвиг после каждого STEP уровней)
    const windowIndex = Math.floor((unlockedMax - 1) / STEP);
    const start = windowIndex * STEP + 1;
    const end = Math.min(start + WINDOW_LEVELS - 1, TOTAL_LEVELS);

    const levels = Array.from({ length: end - start + 1 }, (_, i) => {
        const id = start + i;
        return {
            id,
            unlocked: id <= unlockedMax,
            stars: getStars(id),
        };
    });

    // ✅ делаем rows динамически, но как у тебя: 3 + 3 + 3 + 1 (итого 10)
    const ids = levels.map((l) => l.id);
    type Row = { ids: number[]; side: 'left' | 'right' };

    const rows = [
        { ids: ids.slice(0, 3), side: 'left' as const },
        { ids: ids.slice(3, 6), side: 'right' as const },
        { ids: ids.slice(6, 9), side: 'left' as const },
        { ids: ids.slice(9, 10), side: 'right' as const },
    ].filter((r) => r.ids.length > 0) as Row[];

    return (
        <div className="levels-map">
            <div className="levels-caption">
                Levels {start} – {end} / {TOTAL_LEVELS}
            </div>

            {rows.map((row, idx) => (
                <div key={idx} className={`level-row ${row.side}`}>
                    {row.ids.map((id, i) => {
                        const lvl = levels.find((x) => x.id === id)!;

                        return (
                            <div key={id} style={{ display: 'flex', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    className={`level-node ${lvl.unlocked ? 'open' : 'locked'}`}
                                    onClick={() => lvl.unlocked && onSelect(lvl.id)}
                                    disabled={!lvl.unlocked}
                                    style={{ border: 0 }}
                                >
                                    <div className="level-num">{lvl.id}</div>

                                    <div className="level-stars" aria-label={`${lvl.stars} stars`}>
                                        <span className={lvl.stars >= 1 ? 'on' : ''}>★</span>
                                        <span className={lvl.stars >= 2 ? 'on' : ''}>★</span>
                                        <span className={lvl.stars >= 3 ? 'on' : ''}>★</span>
                                    </div>
                                </button>

                                {i !== row.ids.length - 1 && <div className="level-link" />}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
