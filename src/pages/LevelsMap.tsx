import './match3.css';

const levels = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    unlocked: i === 0, // потом заменим на прогресс
}));

export default function LevelsMap({ onSelect }: { onSelect: (lvl: number) => void }) {
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
                                <div
                                    className={`level-node ${lvl.unlocked ? 'open' : 'locked'}`}
                                    onClick={() => lvl.unlocked && onSelect(lvl.id)}
                                >
                                    {lvl.id}
                                </div>
                                {i !== row.ids.length - 1 && <div className="level-link" />}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
