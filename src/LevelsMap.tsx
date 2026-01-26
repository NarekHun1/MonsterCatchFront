import './match3.css';

function getStars(level: number) {
    return Number(localStorage.getItem(`mc_match3_stars_L${level}`) || '0'); // 0..3
}

export default function LevelsMap({ onSelect }: { onSelect: (lvl: number) => void }) {
    const unlockedMax = Number(localStorage.getItem('mc_match3_unlocked') || '1');

    const levels = Array.from({ length: 10 }, (_, i) => {
        const id = i + 1;
        return {
            id,
            unlocked: id <= unlockedMax,
            stars: getStars(id),
        };
    });

    const rows: { ids: number[]; side: 'left' | 'right' }[] = [
        { ids: [1, 2, 3], side: 'left' },
        { ids: [4, 5, 6], side: 'right' },
        { ids: [7, 8, 9], side: 'left' },
        { ids: [10], side: 'right' },
    ];

    return (
        <div className="levels-map">
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

                                    {/* ⭐️ звёзды */}
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
